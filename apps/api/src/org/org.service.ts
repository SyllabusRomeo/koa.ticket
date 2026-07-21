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
} from './dto/org.dto';

@Injectable()
export class OrgService {
  constructor(private readonly prisma: PrismaService) {}

  listLocations() {
    return this.prisma.location.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async createLocation(dto: CreateLocationDto) {
    const code = dto.code.trim().toUpperCase();
    return this.prisma.location.create({
      data: {
        code,
        name: dto.name.trim(),
        country: dto.country?.trim(),
        site: dto.site?.trim(),
        timezone: dto.timezone ?? 'Africa/Accra',
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
      include: {
        location: { select: { id: true, code: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
        members: {
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createTeam(dto: CreateTeamDto) {
    return this.prisma.team.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim(),
        locationId: dto.locationId,
        departmentId: dto.departmentId,
      },
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

    return this.prisma.teamMember.upsert({
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
  }
}
