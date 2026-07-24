import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { PERMISSIONS } from '@logit/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthUserView } from '../auth/auth.service';

export class CreateAutomationRuleDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsObject()
  conditions!: Record<string, unknown>;

  @IsObject()
  actions!: Record<string, unknown>;
}

export class UpdateAutomationRuleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  actions?: Record<string, unknown>;
}

type AutomationConditions = {
  categoryCode?: string;
  priorityCode?: string;
  locationId?: string;
  majorIncident?: boolean;
  typeCode?: string;
};

type AutomationActions = {
  setTeamId?: string;
  setMajorIncident?: boolean;
  notifyRoleCodes?: string[];
};

@Injectable()
export class AutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  list(user: AuthUserView) {
    this.assertManage(user);
    return this.prisma.automationRule.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  create(user: AuthUserView, dto: CreateAutomationRuleDto) {
    this.assertManage(user);
    return this.prisma.automationRule.create({
      data: {
        name: dto.name.trim(),
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 100,
        conditions: dto.conditions as Prisma.InputJsonValue,
        actions: dto.actions as Prisma.InputJsonValue,
      },
    });
  }

  async update(user: AuthUserView, id: string, dto: UpdateAutomationRuleDto) {
    this.assertManage(user);
    const existing = await this.prisma.automationRule.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Rule not found');
    return this.prisma.automationRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.conditions !== undefined
          ? { conditions: dto.conditions as Prisma.InputJsonValue }
          : {}),
        ...(dto.actions !== undefined
          ? { actions: dto.actions as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  /** Evaluate active rules after ticket create. */
  async evaluateOnCreate(ticket: {
    id: string;
    number: string;
    title: string;
    majorIncident: boolean;
    locationId: string | null;
    teamId: string | null;
    category?: { code: string } | null;
    priority?: { code: string } | null;
    type?: { code: string } | null;
  }) {
    const rules = await this.prisma.automationRule.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      take: 50,
    });

    for (const rule of rules) {
      const conditions = (rule.conditions ?? {}) as AutomationConditions;
      if (!this.matches(conditions, ticket)) continue;

      const actions = (rule.actions ?? {}) as AutomationActions;
      const data: Prisma.TicketUpdateInput = {};
      const history: Prisma.TicketHistoryCreateManyTicketInput[] = [];

      if (actions.setTeamId && actions.setTeamId !== ticket.teamId) {
        data.team = { connect: { id: actions.setTeamId } };
        history.push({
          field: 'team',
          oldValue: ticket.teamId,
          newValue: actions.setTeamId,
        });
        ticket.teamId = actions.setTeamId;
      }

      if (
        actions.setMajorIncident !== undefined &&
        actions.setMajorIncident !== ticket.majorIncident
      ) {
        data.majorIncident = actions.setMajorIncident;
        history.push({
          field: 'major_incident',
          oldValue: String(ticket.majorIncident),
          newValue: String(actions.setMajorIncident),
        });
        ticket.majorIncident = actions.setMajorIncident;
      }

      if (Object.keys(data).length) {
        await this.prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            ...data,
            ...(history.length ? { history: { create: history } } : {}),
          },
        });
      }

      if (actions.notifyRoleCodes?.length) {
        const users = await this.prisma.user.findMany({
          where: {
            deletedAt: null,
            isActive: true,
            roles: {
              some: { role: { code: { in: actions.notifyRoleCodes } } },
            },
          },
          select: { id: true },
          take: 50,
        });
        for (const u of users) {
          await this.notifications.notify({
            userId: u.id,
            eventType: 'ticket.created',
            title: `Automation: ${ticket.number}`,
            body: `${rule.name} — ${ticket.title}`,
            link: `/app/tickets/${encodeURIComponent(ticket.number)}`,
          });
        }
      }
    }
  }

  private matches(
    conditions: AutomationConditions,
    ticket: {
      majorIncident: boolean;
      locationId: string | null;
      category?: { code: string } | null;
      priority?: { code: string } | null;
      type?: { code: string } | null;
    },
  ) {
    if (
      conditions.categoryCode &&
      conditions.categoryCode !== ticket.category?.code
    ) {
      return false;
    }
    if (
      conditions.priorityCode &&
      conditions.priorityCode !== ticket.priority?.code
    ) {
      return false;
    }
    if (conditions.locationId && conditions.locationId !== ticket.locationId) {
      return false;
    }
    if (
      conditions.majorIncident !== undefined &&
      conditions.majorIncident !== ticket.majorIncident
    ) {
      return false;
    }
    if (conditions.typeCode && conditions.typeCode !== ticket.type?.code) {
      return false;
    }
    return true;
  }

  private assertManage(user: AuthUserView) {
    if (!user.permissions.includes(PERMISSIONS.SETTINGS_MANAGE)) {
      throw new ForbiddenException('settings:manage required');
    }
  }
}
