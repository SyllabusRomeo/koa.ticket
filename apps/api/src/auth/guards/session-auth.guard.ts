import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { SESSION_COOKIE } from '@logit/shared';
import { SessionService } from '../session.service';
import { AuthService } from '../auth.service';
import { CURRENT_USER_KEY, IS_PUBLIC_KEY } from '../decorators';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

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
