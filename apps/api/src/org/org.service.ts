import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddTeamMemberDto,
  CreateDepartmentDto,
  CreateLocationDto,
  CreateTeamDto,
  UpdateLocationDto,
  UpdateTeamDto,
} from './dto/org.dto';

@Injectable()
export class OrgService {
  constructor(private readonly prisma: PrismaService) {}

  listLocations() {
    return this.prisma.location.findMany({
      where: { deletedAt: null },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createLocation(dto: CreateLocationDto) {
    const code = dto.code.trim().toUpperCase();
    return this.prisma.location.create({
      data: {
        code,
        name: dto.name.trim(),
        country: dto.country?.trim() || null,
        site: dto.site?.trim() || null,
        timezone: dto.timezone?.trim() || 'Africa/Accra',
      },
    });
  }

  async updateLocation(id: string, dto: UpdateLocationDto) {
    const existing = await this.prisma.location.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Location not found');

    return this.prisma.location.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        country:
          dto.country === undefined
            ? undefined
            : dto.country?.trim() || null,
        site:
          dto.site === undefined ? undefined : dto.site?.trim() || null,
        timezone: dto.timezone?.trim() || undefined,
        isActive: dto.isActive,
      },
    });
  }

  async deactivateLocation(id: string) {
    const existing = await this.prisma.location.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Location not found');

    return this.prisma.location.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  }

  listDepartments() {
    return this.prisma.department.findMany({
      where: { deletedAt: null },
      include: { location: { select: { id: true, code: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createDepartment(dto: CreateDepartmentDto) {
    if (dto.locationId) {
      const loc = await this.prisma.location.findFirst({
        where: { id: dto.locationId, deletedAt: null },
      });
      if (!loc) throw new BadRequestException('Location not found');
    }

    return this.prisma.department.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        locationId: dto.locationId,
      },
    });
  }

  listTeams() {
    return this.prisma.team.findMany({
      where: { deletedAt: null },
      include: this.teamInclude(),
      orderBy: { name: 'asc' },
    });
  }

  private teamInclude() {
    return {
      location: { select: { id: true, code: true, name: true } },
      department: { select: { id: true, code: true, name: true } },
      members: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    } as const;
  }

  async createTeam(dto: CreateTeamDto) {
    if (dto.locationId) {
      const loc = await this.prisma.location.findFirst({
        where: { id: dto.locationId, deletedAt: null },
      });
      if (!loc) throw new BadRequestException('Location not found');
    }
    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, deletedAt: null },
      });
      if (!dept) throw new BadRequestException('Department not found');
    }

    return this.prisma.team.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim(),
        locationId: dto.locationId || undefined,
        departmentId: dto.departmentId || undefined,
      },
      include: this.teamInclude(),
    });
  }

  async updateTeam(id: string, dto: UpdateTeamDto) {
    const existing = await this.prisma.team.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Team not found');

    if (dto.locationId) {
      const loc = await this.prisma.location.findFirst({
        where: { id: dto.locationId, deletedAt: null },
      });
      if (!loc) throw new BadRequestException('Location not found');
    }
    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, deletedAt: null },
      });
      if (!dept) throw new BadRequestException('Department not found');
    }

    return this.prisma.team.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description:
          dto.description === undefined
            ? undefined
            : dto.description.trim() || null,
        locationId:
          dto.locationId === undefined
            ? undefined
            : dto.locationId.trim() || null,
        departmentId:
          dto.departmentId === undefined
            ? undefined
            : dto.departmentId.trim() || null,
        isActive: dto.isActive,
      },
      include: this.teamInclude(),
    });
  }

  async addTeamMember(teamId: string, dto: AddTeamMemberDto) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, deletedAt: null },
    });
    if (!team) throw new NotFoundException('Team not found');

    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
    });
    if (!user) throw new BadRequestException('User not found');

    await this.prisma.teamMember.upsert({
      where: {
        teamId_userId: { teamId, userId: dto.userId },
      },
      create: {
        teamId,
        userId: dto.userId,
        isLead: dto.isLead ?? false,
      },
      update: { isLead: dto.isLead ?? false },
    });

    return this.prisma.team.findFirstOrThrow({
      where: { id: teamId },
      include: this.teamInclude(),
    });
  }

  async removeTeamMember(teamId: string, userId: string) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, deletedAt: null },
    });
    if (!team) throw new NotFoundException('Team not found');

    try {
      await this.prisma.teamMember.delete({
        where: { teamId_userId: { teamId, userId } },
      });
    } catch {
      throw new NotFoundException('Team member not found');
    }

    return this.prisma.team.findFirstOrThrow({
      where: { id: teamId },
      include: this.teamInclude(),
    });
  }
}
