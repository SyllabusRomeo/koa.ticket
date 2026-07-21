import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CURRENT_USER_KEY, PERMISSIONS_KEY, ROLES_KEY } from '../decorators';
import type { AuthUserView } from '../auth.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length && !requiredPermissions?.length) return true;

    const req = context.switchToHttp().getRequest();
    const user = req[CURRENT_USER_KEY] as AuthUserView | undefined;
    if (!user) throw new ForbiddenException('Access denied');

    if (requiredRoles?.length) {
      const ok = requiredRoles.some((r) => user.roles.includes(r));
      if (!ok) throw new ForbiddenException('Insufficient role');
    }

    if (requiredPermissions?.length) {
      const ok = requiredPermissions.every((p) =>
        user.permissions.includes(p),
      );
      if (!ok) throw new ForbiddenException('Insufficient permission');
    }

    return true;
  }
}
