import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PERMISSIONS } from '@logit/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUserView } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';

const SEVERITIES = ['sev1', 'sev2', 'sev3', 'sev4'] as const;
const IM_ROLES = ['commander', 'scribe', 'comms', 'responder'] as const;

export class CreateImIncidentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  summary?: string;

  @IsIn(SEVERITIES)
  severity!: string;

  @IsOptional()
  @IsString()
  ticketId?: string;

  @IsOptional()
  @IsString()
  commanderId?: string;
}

export class AddImUpdateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body!: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}

export class AssignImRoleDto {
  @IsString()
  userId!: string;

  @IsIn(IM_ROLES)
  role!: string;
}

@Injectable()
export class ImService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(user: AuthUserView) {
    this.assertRead(user);
    return this.prisma.imIncident.findMany({
      orderBy: [{ startedAt: 'desc' }],
      take: 100,
      include: {
        commander: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        ticket: { select: { id: true, number: true, title: true } },
        roles: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        _count: { select: { updates: true } },
      },
    });
  }

  async get(user: AuthUserView, idOrNumber: string) {
    this.assertRead(user);
    const incident = await this.prisma.imIncident.findFirst({
      where: {
        OR: [{ id: idOrNumber }, { number: idOrNumber }],
      },
      include: {
        commander: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        ticket: { select: { id: true, number: true, title: true } },
        roles: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        updates: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
      },
    });
    if (!incident) throw new NotFoundException('Incident not found');
    return incident;
  }

  async create(user: AuthUserView, dto: CreateImIncidentDto) {
    this.assertWrite(user);
    const number = await this.nextNumber();
    let ticketId: string | undefined;
    if (dto.ticketId?.trim()) {
      const ticket = await this.prisma.ticket.findFirst({
        where: {
          deletedAt: null,
          OR: [{ id: dto.ticketId }, { number: dto.ticketId }],
        },
        select: { id: true },
      });
      if (!ticket) throw new BadRequestException('Linked ticket not found');
      ticketId = ticket.id;
    }

    const incident = await this.prisma.imIncident.create({
      data: {
        number,
        title: dto.title.trim(),
        summary: dto.summary?.trim() || null,
        severity: dto.severity,
        status: 'declared',
        commanderId: dto.commanderId?.trim() || user.id,
        startedAt: new Date(),
        ticketId,
        roles: {
          create: {
            userId: dto.commanderId?.trim() || user.id,
            role: 'commander',
          },
        },
        updates: {
          create: {
            authorId: user.id,
            body: `Incident declared (${dto.severity}).`,
            isInternal: false,
          },
        },
      },
      include: {
        commander: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        ticket: { select: { id: true, number: true, title: true } },
      },
    });

    await this.audit.log({
      actorId: user.id,
      action: 'im.incident.create',
      entityType: 'im_incident',
      entityId: incident.id,
      after: { number, title: incident.title, severity: incident.severity },
    });

    return incident;
  }

  async addUpdate(user: AuthUserView, idOrNumber: string, dto: AddImUpdateDto) {
    this.assertWrite(user);
    const incident = await this.findIncident(idOrNumber);
    return this.prisma.imIncidentUpdate.create({
      data: {
        incidentId: incident.id,
        authorId: user.id,
        body: dto.body.trim(),
        isInternal: !!dto.isInternal,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async assignRole(
    user: AuthUserView,
    idOrNumber: string,
    dto: AssignImRoleDto,
  ) {
    if (
      !user.permissions.includes(PERMISSIONS.IM_COMMAND) &&
      !user.permissions.includes(PERMISSIONS.IM_WRITE)
    ) {
      throw new ForbiddenException('im:write or im:command required');
    }
    const incident = await this.findIncident(idOrNumber);
    const target = await this.prisma.user.findFirst({
      where: { id: dto.userId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!target) throw new BadRequestException('User not found');

    const role = await this.prisma.imIncidentRole.upsert({
      where: {
        incidentId_userId_role: {
          incidentId: incident.id,
          userId: dto.userId,
          role: dto.role,
        },
      },
      update: {},
      create: {
        incidentId: incident.id,
        userId: dto.userId,
        role: dto.role,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (dto.role === 'commander') {
      await this.prisma.imIncident.update({
        where: { id: incident.id },
        data: { commanderId: dto.userId },
      });
    }

    return role;
  }

  private async nextNumber() {
    const year = new Date().getFullYear();
    const prefix = 'IM';
    const seq = await this.prisma.$transaction(async (tx) => {
      const row = await tx.ticketNumberSequence.upsert({
        where: { prefix_year: { prefix, year } },
        create: { prefix, year, lastValue: 1 },
        update: { lastValue: { increment: 1 } },
      });
      return row.lastValue;
    });
    return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
  }

  private async findIncident(idOrNumber: string) {
    const incident = await this.prisma.imIncident.findFirst({
      where: { OR: [{ id: idOrNumber }, { number: idOrNumber }] },
      select: { id: true, number: true },
    });
    if (!incident) throw new NotFoundException('Incident not found');
    return incident;
  }

  private assertRead(user: AuthUserView) {
    if (!user.permissions.includes(PERMISSIONS.IM_READ)) {
      throw new ForbiddenException('im:read required');
    }
  }

  private assertWrite(user: AuthUserView) {
    if (!user.permissions.includes(PERMISSIONS.IM_WRITE)) {
      throw new ForbiddenException('im:write required');
    }
  }
}
