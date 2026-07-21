import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESSION_COOKIE } from '@logit/shared';
import { SessionService } from '../session.service';
import { AuthService } from '../auth.service';
import { CURRENT_USER_KEY } from '../decorators';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const cookieName = this.config.get('SESSION_COOKIE') ?? SESSION_COOKIE;
    const token: string | undefined =
      req.cookies?.[cookieName] ??
      (typeof req.headers.authorization === 'string' &&
      req.headers.authorization.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : undefined);

    if (!token) throw new UnauthorizedException('Not authenticated');

    const session = await this.sessions.findValidSession(token);
    if (!session) throw new UnauthorizedException('Not authenticated');

    req[CURRENT_USER_KEY] = this.auth.toAuthUser(session.user);
    req.sessionToken = token;
    return true;
  }
}
