import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { AuthUserView } from './auth.service';

export const CURRENT_USER_KEY = 'currentUser';
export const ROLES_KEY = 'roles';
export const PERMISSIONS_KEY = 'permissions';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUserView => {
    const req = ctx.switchToHttp().getRequest();
    return req[CURRENT_USER_KEY];
  },
);

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
