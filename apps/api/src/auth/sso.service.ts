import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as jose from 'jose';
import { PrismaService } from '../prisma/prisma.service';
import { AuthChallengeService } from './auth-challenge.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

type EntraIdToken = {
  oid?: string;
  sub?: string;
  preferred_username?: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
};

@Injectable()
export class SsoService {
  private jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly challenges: AuthChallengeService,
    private readonly sessions: SessionService,
    private readonly passwords: PasswordService,
    private readonly config: ConfigService,
  ) {}

  isEntraConfigured(): boolean {
    return Boolean(
      this.config.get('ENTRA_TENANT_ID') &&
        this.config.get('ENTRA_CLIENT_ID') &&
        this.config.get('ENTRA_CLIENT_SECRET'),
    );
  }

  providers() {
    const list: Array<{ id: string; label: string }> = [];
    if (this.isEntraConfigured()) {
      list.push({ id: 'entra', label: 'Microsoft' });
    }
    return { providers: list };
  }

  private tenant() {
    return this.config.get<string>('ENTRA_TENANT_ID')!;
  }

  private clientId() {
    return this.config.get<string>('ENTRA_CLIENT_ID')!;
  }

  private clientSecret() {
    return this.config.get<string>('ENTRA_CLIENT_SECRET')!;
  }

  private redirectUri() {
    return (
      this.config.get<string>('ENTRA_REDIRECT_URI') ??
      `${this.config.get('API_PUBLIC_URL') ?? 'http://localhost:4100/api/v1'}/auth/sso/entra/callback`
    );
  }

  webOrigin() {
    return (
      this.config.get<string>('APP_PUBLIC_URL') ??
      this.config.get<string>('APP_URL') ??
      'http://localhost:3100'
    );
  }

  private authorityBase() {
    return `https://login.microsoftonline.com/${this.tenant()}/oauth2/v2.0`;
  }

  async beginEntra(): Promise<{ authorizeUrl: string }> {
    if (!this.isEntraConfigured()) {
      throw new BadRequestException('Microsoft Entra SSO is not configured');
    }

    const { token: state } = await this.challenges.create({
      kind: 'entra_oauth',
      ttlMinutes: 15,
      meta: JSON.stringify({ nonce: randomBytes(16).toString('hex') }),
    });

    const params = new URLSearchParams({
      client_id: this.clientId(),
      response_type: 'code',
      redirect_uri: this.redirectUri(),
      response_mode: 'query',
      scope: 'openid profile email',
      state,
      prompt: 'select_account',
    });

    return {
      authorizeUrl: `${this.authorityBase()}/authorize?${params.toString()}`,
    };
  }

  private getJwks() {
    if (!this.jwks) {
      this.jwks = jose.createRemoteJWKSet(
        new URL(
          `https://login.microsoftonline.com/${this.tenant()}/discovery/v2.0/keys`,
        ),
      );
    }
    return this.jwks;
  }

  async completeEntra(
    code: string,
    state: string,
    meta: { ipAddress?: string; userAgent?: string },
  ) {
    if (!this.isEntraConfigured()) {
      throw new BadRequestException('Microsoft Entra SSO is not configured');
    }

    const challenge = await this.challenges.consume(state, 'entra_oauth');
    if (!challenge) {
      throw new UnauthorizedException('Invalid or expired SSO state');
    }

    const body = new URLSearchParams({
      client_id: this.clientId(),
      client_secret: this.clientSecret(),
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri(),
      scope: 'openid profile email',
    });

    const tokenRes = await fetch(`${this.authorityBase()}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!tokenRes.ok) {
      throw new UnauthorizedException('Entra token exchange failed');
    }

    const tokens = (await tokenRes.json()) as {
      id_token?: string;
    };

    if (!tokens.id_token) {
      throw new UnauthorizedException('Entra did not return an id_token');
    }

    const { payload } = await jose.jwtVerify(tokens.id_token, this.getJwks(), {
      issuer: [
        `https://login.microsoftonline.com/${this.tenant()}/v2.0`,
        `https://sts.windows.net/${this.tenant()}/`,
      ],
      audience: this.clientId(),
    });

    const claims = payload as EntraIdToken;
    const email = (claims.email ?? claims.preferred_username ?? '')
      .trim()
      .toLowerCase();
    const subject = claims.oid ?? claims.sub;
    if (!email || !subject) {
      throw new UnauthorizedException('Entra token missing email or subject');
    }

    let user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ externalSubject: subject }, { email }],
      },
    });

    if (!user) {
      const auto =
        this.config.get('ENTRA_AUTO_PROVISION') === 'true' ||
        this.config.get('ENTRA_AUTO_PROVISION') === '1';
      if (!auto) {
        throw new UnauthorizedException(
          'No LogIT account matches this Microsoft identity. Ask an admin to create your user.',
        );
      }
      user = await this.provisionEntraUser(email, subject, claims);
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          authProvider: 'entra',
          externalSubject: subject,
          lastLoginAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    const session = await this.sessions.create({
      userId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await this.prisma.loginAttempt.create({
      data: {
        email,
        ipAddress: meta.ipAddress,
        success: true,
      },
    });

    return {
      userId: user.id,
      sessionToken: session.token,
      expiresAt: session.expiresAt,
      redirectTo: `${this.webOrigin().replace(/\/$/, '')}/app`,
    };
  }

  private async provisionEntraUser(
    email: string,
    subject: string,
    claims: EntraIdToken,
  ) {
    const roleCode = this.config.get('ENTRA_DEFAULT_ROLE') ?? 'employee';
    const role = await this.prisma.role.findUnique({
      where: { code: roleCode },
    });
    if (!role) {
      throw new BadRequestException(
        `Default SSO role "${roleCode}" is not seeded`,
      );
    }

    const nameParts = (claims.name ?? '').trim().split(/\s+/).filter(Boolean);
    const firstName =
      claims.given_name?.trim() || nameParts[0] || email.split('@')[0];
    const lastName =
      claims.family_name?.trim() || nameParts.slice(1).join(' ') || 'User';

    const randomPassword = randomBytes(32).toString('base64url');
    const passwordHash = await this.passwords.hash(
      `Sso-${randomPassword}-Aa1!`,
    );

    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        authProvider: 'entra',
        externalSubject: subject,
        lastLoginAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
      },
    });
  }
}
