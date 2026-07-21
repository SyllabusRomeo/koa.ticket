import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../auth/password.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const userListSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  isActive: true,
  departmentId: true,
  locationId: true,
  lastLoginAt: true,
  createdAt: true,
  location: { select: { id: true, code: true, name: true, site: true } },
  roles: { include: { role: { select: { code: true, name: true } } } },
  extraPermissions: {
    include: { permission: { select: { code: true } } },
  },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  private mapUser(u: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
    departmentId: string | null;
    locationId: string | null;
    lastLoginAt: Date | null;
    createdAt: Date;
    location?: {
      id: string;
      code: string;
      name: string;
      site: string | null;
    } | null;
    roles: Array<{ role: { code: string; name: string } }>;
    extraPermissions: Array<{ permission: { code: string } }>;
    mfaEnabled?: boolean;
  }) {
    const roles = u.roles.map((r) => r.role);
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      isActive: u.isActive,
      departmentId: u.departmentId,
      locationId: u.locationId,
      location: u.location ?? null,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      ...(u.mfaEnabled !== undefined ? { mfaEnabled: u.mfaEnabled } : {}),
      /** Primary role first; legacy multi-role rows collapse to one on next save. */
      roles,
      primaryRole: roles[0] ?? null,
      extraPermissions: u.extraPermissions.map((p) => p.permission.code),
    };
  }

  async list() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: userListSelect,
    });

    return users.map((u) => this.mapUser(u));
  }

  async getById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...userListSelect,
        mfaEnabled: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.mapUser(user);
  }

  async create(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing && !existing.deletedAt) {
      throw new BadRequestException('Email already in use');
    }

    const plain =
      dto.password ??
      `Tmp-${randomBytes(9).toString('base64url')}A1`;
    const policyError = this.passwords.validatePolicy(plain);
    if (policyError) throw new BadRequestException(policyError);

    const roleCodes = dto.roleCodes?.length ? dto.roleCodes : ['employee'];
    if (roleCodes.length > 1) {
      throw new BadRequestException(
        'Assign exactly one primary role (roleCodes length must be 0 or 1)',
      );
    }
    const roles = await this.prisma.role.findMany({
      where: { code: { in: roleCodes } },
    });
    if (roles.length !== roleCodes.length) {
      throw new BadRequestException('One or more roles are invalid');
    }

    const passwordHash = await this.passwords.hash(plain);
    const user = await this.prisma.user.create({
      data: {
        email,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        passwordHash,
        mustChangePassword: !dto.password,
        passwordChangedAt: dto.password ? new Date() : null,
        departmentId: dto.departmentId,
        locationId: dto.locationId,
        roles: {
          create: roles.map((r) => ({ roleId: r.id })),
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        mustChangePassword: true,
      },
    });

    return {
      user,
      temporaryPassword: dto.password ? undefined : plain,
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('User not found');

    if (dto.locationId !== undefined && dto.locationId !== null && dto.locationId.trim()) {
      const loc = await this.prisma.location.findFirst({
        where: { id: dto.locationId.trim(), deletedAt: null },
      });
      if (!loc) throw new BadRequestException('Location not found');
    }
    if (
      dto.departmentId !== undefined &&
      dto.departmentId !== null &&
      dto.departmentId.trim()
    ) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId.trim(), deletedAt: null },
      });
      if (!dept) throw new BadRequestException('Department not found');
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName?.trim(),
        lastName: dto.lastName?.trim(),
        locationId:
          dto.locationId === undefined
            ? undefined
            : dto.locationId === null || !dto.locationId.trim()
              ? null
              : dto.locationId.trim(),
        departmentId:
          dto.departmentId === undefined
            ? undefined
            : dto.departmentId === null || !dto.departmentId.trim()
              ? null
              : dto.departmentId.trim(),
      },
    });

    return this.getById(id);
  }

  /**
   * Sets the user's single primary role and optional additive extras.
   * Extras already implied by the role are dropped on save (stored set stays lean).
   * Changing the role does not clear extras — only the payload does.
   */
  async setAccess(
    userId: string,
    opts: {
      roleCode?: string;
      roleCodes?: string[];
      extraPermissionCodes?: string[];
    },
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    const roleCode =
      opts.roleCode?.trim() ||
      (opts.roleCodes?.length ? opts.roleCodes[0] : undefined);
    if (!roleCode) {
      throw new BadRequestException('roleCode is required');
    }
    if (opts.roleCodes && opts.roleCodes.length > 1) {
      throw new BadRequestException(
        'Assign exactly one primary role (use roleCode or a single-element roleCodes)',
      );
    }

    const role = await this.prisma.role.findUnique({
      where: { code: roleCode },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new BadRequestException('Invalid role');

    const rolePermSet = new Set(
      role.permissions.map((p) => p.permission.code),
    );

    let uniqueExtras: string[];
    if (opts.extraPermissionCodes !== undefined) {
      uniqueExtras = [...new Set(opts.extraPermissionCodes)].filter(
        (c) => !rolePermSet.has(c),
      );
    } else {
      // Role-only update: keep existing extras that are still additive.
      const existing = await this.prisma.userPermission.findMany({
        where: { userId },
        include: { permission: true },
      });
      uniqueExtras = existing
        .map((e) => e.permission.code)
        .filter((c) => !rolePermSet.has(c));
    }

    const perms =
      uniqueExtras.length === 0
        ? []
        : await this.prisma.permission.findMany({
            where: { code: { in: uniqueExtras } },
          });
    if (perms.length !== uniqueExtras.length) {
      throw new BadRequestException('One or more permissions are invalid');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userRole.create({
        data: { userId, roleId: role.id },
      });
      await tx.userPermission.deleteMany({ where: { userId } });
      if (perms.length) {
        await tx.userPermission.createMany({
          data: perms.map((p) => ({
            userId,
            permissionId: p.id,
          })),
        });
      }
    });

    return this.getById(userId);
  }

  async rolesMatrix() {
    const roles = await this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });
    const allPermissions = await this.prisma.permission.findMany({
      orderBy: { code: 'asc' },
      select: { code: true, name: true, description: true },
    });
    return {
      roles: roles.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
        userCount: r._count.users,
        permissions: r.permissions.map((p) => p.permission.code),
      })),
      allPermissions,
    };
  }
}
