import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../auth/password.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async list() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        departmentId: true,
        locationId: true,
        lastLoginAt: true,
        createdAt: true,
        roles: { include: { role: { select: { code: true, name: true } } } },
      },
    });

    return users.map((u) => ({
      ...u,
      roles: u.roles.map((r) => r.role),
    }));
  }

  async getById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        mfaEnabled: true,
        departmentId: true,
        locationId: true,
        lastLoginAt: true,
        createdAt: true,
        roles: { include: { role: { select: { code: true, name: true } } } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return { ...user, roles: user.roles.map((r) => r.role) };
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

  async setRoles(userId: string, roleCodes: string[]) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    const roles = await this.prisma.role.findMany({
      where: { code: { in: roleCodes } },
    });
    if (roles.length !== roleCodes.length) {
      throw new BadRequestException('One or more roles are invalid');
    }

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.userRole.createMany({
        data: roles.map((r) => ({ userId, roleId: r.id })),
      }),
    ]);

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
    return roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      userCount: r._count.users,
      permissions: r.permissions.map((p) => p.permission.code),
    }));
  }
}
