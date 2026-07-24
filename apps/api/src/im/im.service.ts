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

export class UpdateImStatusDto {
  @IsIn(['declared', 'active', 'mitigated', 'resolved', 'closed'])
  status!: string;
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

  /**
   * Ops dashboard KPIs + breakdowns for the IM command board.
   */
  async dashboard(user: AuthUserView) {
    this.assertRead(user);
    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const openStatuses = ['declared', 'active', 'mitigated'];

    const rows = await this.prisma.imIncident.findMany({
      select: {
        id: true,
        number: true,
        title: true,
        severity: true,
        status: true,
        startedAt: true,
        resolvedAt: true,
        commanderId: true,
        ticketId: true,
      },
      orderBy: [{ startedAt: 'desc' }],
      take: 500,
    });

    const open = rows.filter((r) => openStatuses.includes(r.status));
    const bySeverity = { sev1: 0, sev2: 0, sev3: 0, sev4: 0 };
    const byStatus = {
      declared: 0,
      active: 0,
      mitigated: 0,
      resolved: 0,
      closed: 0,
    };
    for (const r of rows) {
      if (r.severity in bySeverity) {
        bySeverity[r.severity as keyof typeof bySeverity] += 1;
      }
      if (r.status in byStatus) {
        byStatus[r.status as keyof typeof byStatus] += 1;
      }
    }

    const openSev1 = open.filter((r) => r.severity === 'sev1').length;
    const openSev2 = open.filter((r) => r.severity === 'sev2').length;
    const noCommander = open.filter((r) => !r.commanderId).length;
    const linkedItsm = open.filter((r) => !!r.ticketId).length;
    const resolvedLast7d = rows.filter(
      (r) =>
        (r.status === 'resolved' || r.status === 'closed') &&
        r.resolvedAt &&
        r.resolvedAt >= sevenDaysAgo,
    ).length;
    const closedLast30d = rows.filter(
      (r) =>
        r.status === 'closed' &&
        r.resolvedAt &&
        r.resolvedAt >= thirtyDaysAgo,
    ).length;

    const durations: number[] = [];
    for (const r of rows) {
      if (
        (r.status === 'resolved' || r.status === 'closed') &&
        r.resolvedAt
      ) {
        durations.push(
          Math.max(0, r.resolvedAt.getTime() - r.startedAt.getTime()),
        );
      }
    }
    const mttrMinutes =
      durations.length > 0
        ? Math.round(
            durations.reduce((a, b) => a + b, 0) / durations.length / 60_000,
          )
        : null;

    const oldestOpenMs = open.length
      ? Math.max(...open.map((r) => now - r.startedAt.getTime()))
      : null;

    return {
      generatedAt: new Date().toISOString(),
      kpis: {
        open: open.length,
        openSev1,
        openSev2,
        noCommander,
        linkedItsm,
        resolvedLast7d,
        closedLast30d,
        mttrMinutes,
        oldestOpenHours:
          oldestOpenMs != null
            ? Math.round(oldestOpenMs / 3_600_000)
            : null,
        total: rows.length,
      },
      bySeverity,
      byStatus,
      active: open.slice(0, 25).map((r) => ({
        id: r.id,
        number: r.number,
        title: r.title,
        severity: r.severity,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        ageHours: Math.round((now - r.startedAt.getTime()) / 3_600_000),
      })),
    };
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

  async updateStatus(
    user: AuthUserView,
    idOrNumber: string,
    dto: UpdateImStatusDto,
  ) {
    this.assertWrite(user);
    const existing = await this.findIncident(idOrNumber);
    const data: {
      status: string;
      resolvedAt?: Date | null;
    } = { status: dto.status };
    if (dto.status === 'resolved' || dto.status === 'closed') {
      data.resolvedAt = new Date();
    }
    if (dto.status === 'declared' || dto.status === 'active') {
      data.resolvedAt = null;
    }
    const incident = await this.prisma.imIncident.update({
      where: { id: existing.id },
      data,
    });
    await this.prisma.imIncidentUpdate.create({
      data: {
        incidentId: existing.id,
        authorId: user.id,
        body: `Status → ${dto.status}.`,
        isInternal: false,
      },
    });
    await this.audit.log({
      actorId: user.id,
      action: 'im.incident.status',
      entityType: 'im_incident',
      entityId: existing.id,
      after: { status: dto.status },
    });
    return incident;
  }

  /**
   * Post-incident review draft generated from timeline + roles (markdown).
   */
  async pirDraft(user: AuthUserView, idOrNumber: string) {
    if (
      !user.permissions.includes(PERMISSIONS.IM_POSTMORTEM) &&
      !user.permissions.includes(PERMISSIONS.IM_READ)
    ) {
      throw new ForbiddenException('im:read or im:postmortem required');
    }
    const incident = await this.get(user, idOrNumber);
    const person = (u: {
      firstName: string;
      lastName: string;
      email: string;
    }) => `${u.firstName} ${u.lastName} <${u.email}>`.trim();

    const lines: string[] = [
      `# Post-Incident Review — ${incident.number}`,
      '',
      `**Title:** ${incident.title}`,
      `**Severity:** ${incident.severity}`,
      `**Status:** ${incident.status}`,
      `**Started:** ${new Date(incident.startedAt).toISOString()}`,
      incident.resolvedAt
        ? `**Resolved:** ${new Date(incident.resolvedAt).toISOString()}`
        : '**Resolved:** —',
      incident.commander
        ? `**Commander:** ${person(incident.commander)}`
        : '**Commander:** —',
      incident.ticket
        ? `**Linked ITSM ticket:** ${incident.ticket.number} — ${incident.ticket.title}`
        : '**Linked ITSM ticket:** —',
      '',
      '## Summary',
      incident.summary?.trim() || '_Add executive summary._',
      '',
      '## Roles',
    ];

    if (incident.roles.length) {
      for (const r of incident.roles) {
        lines.push(`- **${r.role}:** ${person(r.user)}`);
      }
    } else {
      lines.push('_No roles assigned._');
    }

    lines.push('', '## Timeline (stakeholder / public)');
    const publicUpdates = incident.updates.filter((u) => !u.isInternal);
    if (publicUpdates.length) {
      for (const u of publicUpdates) {
        lines.push(
          `- **${new Date(u.createdAt).toISOString()}** — ${person(u.author)}: ${u.body}`,
        );
      }
    } else {
      lines.push('_No public updates._');
    }

    lines.push('', '## Timeline (internal)');
    const internalUpdates = incident.updates.filter((u) => u.isInternal);
    if (internalUpdates.length) {
      for (const u of internalUpdates) {
        lines.push(
          `- **${new Date(u.createdAt).toISOString()}** — ${person(u.author)}: ${u.body}`,
        );
      }
    } else {
      lines.push('_No internal updates._');
    }

    lines.push(
      '',
      '## Impact',
      '_Describe customer / business impact, scope, and duration._',
      '',
      '## Root cause',
      '_What failed and why (5 whys / contributing factors)._',
      '',
      '## Detection & response',
      '_How was it detected? What worked / did not in response?_',
      '',
      '## Corrective actions',
      '| Action | Owner | Due |',
      '| --- | --- | --- |',
      '|  |  |  |',
      '',
      '## Lessons learned',
      '_What will we change in process, tooling, or architecture?_',
      '',
      `---`,
      `_Draft generated ${new Date().toISOString()} from LogIt IMS timeline._`,
    );

    return {
      number: incident.number,
      title: incident.title,
      format: 'markdown' as const,
      markdown: lines.join('\n'),
      generatedAt: new Date().toISOString(),
    };
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
