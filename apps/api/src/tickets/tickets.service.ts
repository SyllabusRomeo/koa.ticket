import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PERMISSIONS, ROLES } from '@logit/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUserView } from '../auth/auth.service';
import { AssignmentService } from '../assignment/assignment.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { AuditService } from '../audit/audit.service';
import { AutomationService } from '../automation/automation.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  statusChangeEventType,
  statusChangeLabel,
} from '../notifications/notification-events';
import { PresenceService } from '../presence/presence.service';
import { SlaService } from '../sla/sla.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import {
  AddCommentDto,
  AddWorkLogDto,
  CreateSavedViewDto,
  CreateTicketDto,
  UpdateSavedViewDto,
  UpdateTicketDto,
} from './dto/ticket.dto';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignment: AssignmentService,
    private readonly approvals: ApprovalsService,
    private readonly audit: AuditService,
    private readonly automation: AutomationService,
    private readonly notifications: NotificationsService,
    private readonly sla: SlaService,
    private readonly presence: PresenceService,
    private readonly webhooks: WebhooksService,
  ) {}

  private canStaffTickets(user: AuthUserView) {
    return (
      user.permissions.includes(PERMISSIONS.TICKETS_READ_ALL) ||
      user.permissions.includes(PERMISSIONS.TICKETS_READ_QUEUE) ||
      user.permissions.includes(PERMISSIONS.SETTINGS_MANAGE)
    );
  }

  private canSoftDelete(user: AuthUserView) {
    return (
      user.permissions.includes(PERMISSIONS.SETTINGS_MANAGE) ||
      (user.permissions.includes(PERMISSIONS.TICKETS_READ_ALL) &&
        user.permissions.includes(PERMISSIONS.TICKETS_WRITE))
    );
  }

  /** Managers / admins / auditors — full organization ticket visibility. */
  private canReadOrgTickets(user: AuthUserView) {
    return (
      user.permissions.includes(PERMISSIONS.TICKETS_READ_ALL) ||
      user.permissions.includes(PERMISSIONS.SETTINGS_MANAGE)
    );
  }

  /**
   * Agents with queue rights (but not org-wide read) only see tickets assigned
   * to them, plus any they requested or watch.
   */
  private canReadAssignedQueue(user: AuthUserView) {
    return (
      !this.canReadOrgTickets(user) &&
      user.permissions.includes(PERMISSIONS.TICKETS_READ_QUEUE)
    );
  }

  /** Staff who can work tickets (org-wide or assigned queue). */
  private canBrowseStaffTickets(user: AuthUserView) {
    return this.canStaffTickets(user);
  }

  /** @deprecated Prefer canReadOrgTickets / visibilityWhere. */
  private canReadAll(user: AuthUserView) {
    return this.canBrowseStaffTickets(user);
  }

  private canInternalNote(user: AuthUserView) {
    return user.permissions.includes(PERMISSIONS.TICKETS_INTERNAL_NOTE);
  }

  /** Privileged for restricted/sensitive tickets. */
  private canSeeRestricted(user: AuthUserView) {
    return (
      user.permissions.includes(PERMISSIONS.TICKETS_READ_ALL) ||
      user.permissions.includes(PERMISSIONS.SETTINGS_MANAGE) ||
      user.roles.includes(ROLES.IT_MANAGER) ||
      user.roles.includes(ROLES.SYSADMIN)
    );
  }

  private personalTicketWhere(userId: string): Prisma.TicketWhereInput {
    return {
      OR: [
        { requesterId: userId },
        { assigneeId: userId },
        { watchers: { some: { userId } } },
      ],
    };
  }

  /** Extra filter: restricted tickets only for privileged / parties. */
  private restrictedVisibilityClause(
    user: AuthUserView,
  ): Prisma.TicketWhereInput {
    if (this.canSeeRestricted(user)) return {};
    return {
      OR: [
        { restricted: false },
        { requesterId: user.id },
        { assigneeId: user.id },
      ],
    };
  }

  /** Prisma filter for ticket lists / exports based on role. */
  private visibilityWhere(user: AuthUserView): Prisma.TicketWhereInput {
    const restricted = this.restrictedVisibilityClause(user);
    if (this.canReadOrgTickets(user)) {
      return restricted;
    }
    // Agents: only tickets assigned to them.
    if (this.canReadAssignedQueue(user)) {
      return { AND: [{ assigneeId: user.id }, restricted] };
    }
    // End users: requested, assigned, or watching (watchers blocked on restricted).
    return { AND: [this.personalTicketWhere(user.id), restricted] };
  }

  private async assertTicketVisible(
    user: AuthUserView,
    ticket: {
      id: string;
      requesterId: string;
      assigneeId: string | null;
      restricted?: boolean;
    },
  ) {
    if (ticket.restricted) {
      const party =
        ticket.requesterId === user.id || ticket.assigneeId === user.id;
      if (!party && !this.canSeeRestricted(user)) {
        throw new ForbiddenException('Ticket not found');
      }
    }

    if (this.canReadOrgTickets(user)) return;

    // Agents may open assigned work; also their own requests / watches.
    if (this.canReadAssignedQueue(user)) {
      if (ticket.assigneeId === user.id) return;
      if (ticket.requesterId === user.id) return;
      if (!ticket.restricted) {
        const watching = await this.prisma.ticketWatcher.findUnique({
          where: {
            ticketId_userId: { ticketId: ticket.id, userId: user.id },
          },
        });
        if (watching) return;
      }
      throw new ForbiddenException('Ticket not found');
    }

    if (ticket.requesterId === user.id || ticket.assigneeId === user.id) {
      return;
    }

    if (!ticket.restricted) {
      const watching = await this.prisma.ticketWatcher.findUnique({
        where: {
          ticketId_userId: { ticketId: ticket.id, userId: user.id },
        },
      });
      if (watching) return;
    }

    throw new ForbiddenException('Ticket not found');
  }

  async nextNumber(prefix: string) {
    const year = new Date().getFullYear();
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

  async resolvePriority(impact?: string, urgency?: string) {
    if (!impact || !urgency) return null;
    const cell = await this.prisma.priorityMatrix.findUnique({
      where: { impact_urgency: { impact, urgency } },
      include: { priority: true },
    });
    return cell?.priority ?? null;
  }

  async create(user: AuthUserView, dto: CreateTicketDto) {
    if (!user.permissions.includes(PERMISSIONS.TICKETS_WRITE)) {
      throw new ForbiddenException('Cannot create tickets');
    }

    const type = await this.prisma.ticketType.findFirst({
      where: { code: dto.typeCode, isActive: true },
    });
    if (!type) throw new BadRequestException('Invalid ticket type');

    const needsApproval =
      type.code === 'service_request' ||
      type.code === 'access_request' ||
      type.code === 'change';
    const initialStatusCode = needsApproval ? 'pending_approval' : 'new';
    const status = await this.prisma.ticketStatus.findUniqueOrThrow({
      where: { code: initialStatusCode },
    });

    let categoryId: string | undefined;
    let subcategoryId: string | undefined;
    if (dto.categoryCode) {
      const category = await this.prisma.category.findFirst({
        where: { code: dto.categoryCode, deletedAt: null, isActive: true },
      });
      if (!category) throw new BadRequestException('Invalid category');
      categoryId = category.id;

      if (dto.subcategoryCode) {
        const sub = await this.prisma.subcategory.findFirst({
          where: {
            code: dto.subcategoryCode,
            categoryId: category.id,
            deletedAt: null,
            isActive: true,
          },
        });
        if (!sub) throw new BadRequestException('Invalid subcategory');
        subcategoryId = sub.id;
      }
    }

    const impact = dto.impact ?? 'medium';
    const urgency = dto.urgency ?? 'medium';
    const priority = await this.resolvePriority(impact, urgency);
    const number = await this.nextNumber(type.prefix);

    /** Always resolve from DB so we don't rely on a stale session profile. */
    const requester = await this.prisma.user.findFirst({
      where: { id: user.id, deletedAt: null },
      select: { locationId: true, departmentId: true },
    });

    /**
     * Ticket origin site: explicit active location override, else the
     * requester's home location (even if later deactivated — still stamped).
     */
    let locationId: string | null = requester?.locationId ?? null;
    if (dto.locationId !== undefined && String(dto.locationId).trim()) {
      const trimmed = String(dto.locationId).trim();
      const loc = await this.prisma.location.findFirst({
        where: { id: trimmed, deletedAt: null, isActive: true },
      });
      if (!loc) throw new BadRequestException('Location not found');
      locationId = loc.id;
    } else if (locationId) {
      // Prefer an active home location; if home was soft-deleted, keep the id
      // so history stays accurate, but try to map to an active site by code.
      const home = await this.prisma.location.findFirst({
        where: { id: locationId },
      });
      if (home && (home.deletedAt || !home.isActive)) {
        const replacement = await this.prisma.location.findFirst({
          where: {
            deletedAt: null,
            isActive: true,
            OR: [{ code: home.code }, { name: home.name }],
          },
          orderBy: { createdAt: 'asc' },
        });
        if (replacement) locationId = replacement.id;
      }
    }

    const departmentId = requester?.departmentId ?? user.departmentId;

    const routing = await this.assignment.resolveRouting({
      categoryId,
      typeId: type.id,
      locationId,
    });
    const teamId = routing.teamId;
    const assigneeId = routing.assigneeId;

    let parentId: string | undefined;
    if (dto.parentNumber) {
      const parent = await this.prisma.ticket.findFirst({
        where: {
          deletedAt: null,
          OR: [{ id: dto.parentNumber }, { number: dto.parentNumber }],
        },
        select: { id: true, number: true },
      });
      if (!parent) throw new BadRequestException('Parent ticket not found');
      parentId = parent.id;
    }

    const majorIncident =
      !!dto.majorIncident &&
      (type.code === 'incident' || type.code === 'security_incident') &&
      this.canStaffTickets(user);

    const restricted =
      dto.restricted !== undefined
        ? !!dto.restricted &&
          user.permissions.includes(PERMISSIONS.TICKETS_WRITE)
        : type.code === 'security_incident';

    const channel = dto.channel ?? 'web';
    const channelMeta = dto.channelMeta
      ? (dto.channelMeta as Prisma.InputJsonValue)
      : undefined;

    const ticket = await this.prisma.ticket.create({
      data: {
        number,
        title: dto.title.trim(),
        description: dto.description.trim(),
        typeId: type.id,
        statusId: status.id,
        priorityId: priority?.id,
        categoryId,
        subcategoryId,
        impact,
        urgency,
        requesterId: user.id,
        departmentId,
        locationId,
        teamId: teamId ?? undefined,
        assigneeId: assigneeId ?? undefined,
        parentId,
        majorIncident,
        restricted,
        channel,
        channelMeta,
        cabRequired: type.code === 'change',
        history: {
          create: [
            {
              actorId: user.id,
              field: 'created',
              newValue: number,
            },
            {
              actorId: user.id,
              field: 'channel',
              newValue: channel,
            },
            ...(teamId
              ? [
                  {
                    actorId: user.id,
                    field: 'team',
                    newValue: teamId,
                  },
                ]
              : []),
            ...(assigneeId
              ? [
                  {
                    actorId: user.id,
                    field: 'assignee',
                    newValue: assigneeId,
                  },
                ]
              : []),
            ...(parentId
              ? [
                  {
                    actorId: user.id,
                    field: 'parent',
                    newValue: dto.parentNumber!.trim(),
                  },
                ]
              : []),
            ...(majorIncident
              ? [
                  {
                    actorId: user.id,
                    field: 'major_incident',
                    newValue: 'true',
                  },
                ]
              : []),
            ...(restricted
              ? [
                  {
                    actorId: user.id,
                    field: 'restricted',
                    newValue: 'true',
                  },
                ]
              : []),
          ],
        },
      },
      include: this.defaultInclude(false),
    });

    await this.sla.createForTicket(ticket.id, priority?.id);
    await this.audit.log({
      actorId: user.id,
      action: 'ticket.create',
      entityType: 'ticket',
      entityId: ticket.id,
      after: { number, title: ticket.title },
    });

    if (needsApproval) {
      await this.approvals.createForTicket(ticket.id, ticket.title, number);
    }

    await this.automation.evaluateOnCreate({
      id: ticket.id,
      number: ticket.number,
      title: ticket.title,
      majorIncident: ticket.majorIncident,
      locationId: ticket.locationId,
      teamId: ticket.teamId,
      category: ticket.category,
      priority: ticket.priority,
      type: ticket.type,
    });

    const notified = new Set<string>();
    if (assigneeId) {
      await this.notifications.notify({
        userId: assigneeId,
        eventType: 'ticket.assigned',
        title: `Assigned ${number}`,
        body: ticket.title,
        link: `/app/tickets/${ticket.number}`,
        email: { ticketNumber: number, eventLabel: 'Assigned to you' },
      });
      notified.add(assigneeId);
    }
    if (teamId) {
      const members = await this.prisma.teamMember.findMany({
        where: { teamId },
        select: { userId: true },
        take: 20,
      });
      for (const m of members) {
        if (notified.has(m.userId)) continue;
        await this.notifications.notify({
          userId: m.userId,
          eventType: 'ticket.created',
          title: `New ticket ${number}`,
          body: ticket.title,
          link: `/app/tickets/${ticket.number}`,
          email: { ticketNumber: number, eventLabel: 'New ticket' },
        });
        notified.add(m.userId);
      }
    }

    if (!notified.has(ticket.requesterId)) {
      await this.notifications.notify({
        userId: ticket.requesterId,
        eventType: 'ticket.created',
        title: `Ticket opened ${number}`,
        body: ticket.title,
        link: `/app/tickets/${ticket.number}`,
        email: { ticketNumber: number, eventLabel: 'Ticket opened' },
      });
    }

    this.webhooks.emit('ticket.created', {
      ticket: {
        id: ticket.id,
        number: ticket.number,
        title: ticket.title,
        statusCode: ticket.status?.code ?? null,
        priorityCode: ticket.priority?.code ?? null,
        typeCode: ticket.type?.code ?? null,
        requesterId: ticket.requesterId,
        assigneeId: ticket.assigneeId,
        teamId: ticket.teamId,
        isMajorIncident: ticket.majorIncident,
      },
      actorId: user.id,
    });
    if (assigneeId) {
      this.webhooks.emit('ticket.assigned', {
        ticket: {
          id: ticket.id,
          number: ticket.number,
          title: ticket.title,
          assigneeId,
        },
        actorId: user.id,
        previousAssigneeId: null,
      });
    }

    const withSla = await this.prisma.ticket.findFirstOrThrow({
      where: { id: ticket.id },
      include: this.defaultInclude(false),
    });
    return this.serialize(withSla, user);
  }

  async list(
    user: AuthUserView,
    opts: {
      locationId?: string;
      typeCode?: string;
      statusCode?: string;
      assigneeId?: string;
      queue?: string;
      majorIncident?: boolean;
      channel?: string;
      /** Free-text: ticket number, title, description, requester/assignee */
      q?: string;
    } = {},
  ) {
    const where: Prisma.TicketWhereInput = {
      deletedAt: null,
      ...this.visibilityWhere(user),
    };

    const staff = this.canStaffTickets(user);
    const orgWide = this.canReadOrgTickets(user);

    if (opts.locationId && orgWide) {
      where.locationId = opts.locationId;
    }
    if (opts.typeCode) {
      where.type = { code: opts.typeCode };
    }
    if (opts.statusCode) {
      where.status = { code: opts.statusCode };
    }
    if (opts.majorIncident !== undefined && staff) {
      where.majorIncident = opts.majorIncident;
    }
    if (opts.channel?.trim()) {
      where.channel = opts.channel.trim().toLowerCase();
    }

    // Org-wide staff can filter queues; agents are already limited to their work.
    if (orgWide && opts.queue === 'mine') {
      where.assigneeId = user.id;
    } else if (orgWide && opts.queue === 'unassigned') {
      where.assigneeId = null;
      if (!opts.statusCode) {
        where.status = { isTerminal: false };
      }
    } else if (orgWide && opts.assigneeId) {
      where.assigneeId = opts.assigneeId;
    }

    const q = opts.q?.trim();
    if (q) {
      where.AND = [
        ...(Array.isArray(where.AND)
          ? where.AND
          : where.AND
            ? [where.AND]
            : []),
        {
          OR: [
            { number: { contains: q, mode: 'insensitive' } },
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            {
              requester: {
                OR: [
                  { email: { contains: q, mode: 'insensitive' } },
                  { firstName: { contains: q, mode: 'insensitive' } },
                  { lastName: { contains: q, mode: 'insensitive' } },
                ],
              },
            },
            {
              assignee: {
                OR: [
                  { email: { contains: q, mode: 'insensitive' } },
                  { firstName: { contains: q, mode: 'insensitive' } },
                  { lastName: { contains: q, mode: 'insensitive' } },
                ],
              },
            },
          ],
        },
      ];
    }

    const tickets = await this.prisma.ticket.findMany({
      where,
      orderBy: [{ majorIncident: 'desc' }, { createdAt: 'desc' }],
      take: 200,
      include: this.defaultInclude(false),
    });

    return tickets.map((t) => this.serialize(t, user));
  }

  /** Kanban / workload board for agents (non-terminal statuses). */
  async board(
    user: AuthUserView,
    opts: { scope?: 'all' | 'mine' | 'unassigned' } = {},
  ) {
    if (!this.canStaffTickets(user)) {
      throw new ForbiddenException('Queue board requires agent access');
    }

    const orgWide = this.canReadOrgTickets(user);
    let scope = opts.scope ?? (orgWide ? 'all' : 'mine');
    // Agents without org-wide read are limited to their assignments.
    if (!orgWide) {
      scope = 'mine';
    }

    const where: Prisma.TicketWhereInput = {
      deletedAt: null,
      status: { isTerminal: false },
    };
    if (scope === 'mine') where.assigneeId = user.id;
    if (scope === 'unassigned') where.assigneeId = null;

    const [statuses, tickets, transitionRows] = await Promise.all([
      this.prisma.ticketStatus.findMany({
        where: { isTerminal: false },
        orderBy: { sortOrder: 'asc' },
        select: { code: true, name: true, sortOrder: true },
      }),
      this.prisma.ticket.findMany({
        where,
        orderBy: [{ majorIncident: 'desc' }, { createdAt: 'desc' }],
        take: 300,
        include: this.defaultInclude(false),
      }),
      this.prisma.ticketStatusTransition.findMany({
        include: {
          fromStatus: { select: { code: true } },
          toStatus: { select: { code: true } },
        },
      }),
    ]);

    const serialized = tickets.map((t) => this.serialize(t, user));
    const byStatus = new Map<string, typeof serialized>();
    for (const s of statuses) byStatus.set(s.code, []);
    for (const t of serialized) {
      const code = t.status?.code ?? 'new';
      const list = byStatus.get(code) ?? [];
      list.push(t);
      byStatus.set(code, list);
    }

    const workloadMap = new Map<
      string,
      { userId: string | null; name: string; count: number }
    >();
    for (const t of tickets) {
      const key = t.assigneeId ?? 'unassigned';
      const name = t.assignee
        ? `${t.assignee.firstName} ${t.assignee.lastName}`.trim() ||
          t.assignee.email
        : 'Unassigned';
      const row = workloadMap.get(key) ?? {
        userId: t.assigneeId,
        name,
        count: 0,
      };
      row.count += 1;
      workloadMap.set(key, row);
    }

    const transitions: Record<string, string[]> = {};
    for (const row of transitionRows) {
      const from = row.fromStatus.code;
      const to = row.toStatus.code;
      if (!transitions[from]) transitions[from] = [];
      if (!transitions[from].includes(to)) transitions[from].push(to);
    }

    return {
      scope,
      columns: statuses.map((s) => ({
        code: s.code,
        name: s.name,
        tickets: byStatus.get(s.code) ?? [],
      })),
      workload: [...workloadMap.values()].sort((a, b) => b.count - a.count),
      transitions,
      total: serialized.length,
      generatedAt: new Date().toISOString(),
    };
  }

  /** Ops dashboard for major incidents — active MIs with related children. */
  async majorIncidentsOps(user: AuthUserView) {
    if (!this.canStaffTickets(user)) {
      throw new ForbiddenException('Major incident ops requires agent access');
    }

    const now = Date.now();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const tickets = await this.prisma.ticket.findMany({
      where: {
        deletedAt: null,
        majorIncident: true,
        ...this.visibilityWhere(user),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
      include: {
        ...this.defaultInclude(false),
        children: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            status: { select: { code: true, name: true, isTerminal: true } },
            priority: { select: { code: true, name: true } },
            type: { select: { code: true, name: true } },
            assignee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        parent: {
          select: {
            id: true,
            number: true,
            title: true,
            majorIncident: true,
            status: { select: { code: true, name: true } },
          },
        },
      },
    });

    const serialized = tickets.map((t) => {
      const base = this.serialize(t, user);
      return {
        ...base,
        children: (t.children ?? []).map((c) => ({
          id: c.id,
          number: c.number,
          title: c.title,
          status: c.status,
          priority: c.priority,
          type: c.type,
          assignee: c.assignee,
        })),
        parent: t.parent
          ? {
              id: t.parent.id,
              number: t.parent.number,
              title: t.parent.title,
              majorIncident: t.parent.majorIncident,
              status: t.parent.status,
            }
          : null,
      };
    });

    const active = serialized.filter((t) => !t.status?.isTerminal);
    const resolvedRecent = serialized.filter((t) => {
      if (!t.status?.isTerminal) return false;
      const stamp =
        (t as { resolvedAt?: string | Date | null }).resolvedAt ??
        (t as { closedAt?: string | Date | null }).closedAt ??
        (t as { updatedAt?: string | Date | null }).updatedAt;
      if (!stamp) return false;
      return new Date(stamp).getTime() >= weekAgo.getTime();
    });

    let breached = 0;
    let unassigned = 0;
    let withRelated = 0;
    for (const t of active) {
      const remaining = t.slaRemainingMs;
      if (t.slaBreached || (remaining != null && remaining < 0)) {
        breached += 1;
      }
      const assignee = (t as { assignee?: { id: string } | null }).assignee;
      if (!assignee) unassigned += 1;
      const kids = t.children?.length ?? 0;
      if (kids > 0 || t.parent) withRelated += 1;
    }

    return {
      kpis: {
        active: active.length,
        breached,
        unassigned,
        withRelated,
        resolvedLast7d: resolvedRecent.length,
        totalTracked: serialized.length,
      },
      active,
      recentlyResolved: resolvedRecent.slice(0, 20),
      generatedAt: new Date().toISOString(),
    };
  }

  /** CSV of the same ticket visibility as list (scoped for employees). */
  async exportCsv(user: AuthUserView, ipAddress?: string | null) {
    const where: Prisma.TicketWhereInput = {
      deletedAt: null,
      ...this.visibilityWhere(user),
    };

    const tickets = await this.prisma.ticket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5000,
      include: this.defaultInclude(false),
    });

    await this.audit.log({
      actorId: user.id,
      action: 'tickets.export',
      entityType: 'tickets',
      after: { count: tickets.length, format: 'csv' },
      ipAddress,
    });

    const escape = (value: string | number | null | undefined) => {
      const s = value == null ? '' : String(value);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const person = (
      p?: {
        email: string;
        firstName: string;
        lastName: string;
      } | null,
    ) => {
      if (!p) return '';
      const name = `${p.firstName} ${p.lastName}`.trim();
      return name ? `${name} <${p.email}>` : p.email;
    };

    const header = [
      'number',
      'title',
      'status',
      'priority',
      'type',
      'channel',
      'location',
      'site',
      'requester',
      'assignee',
      'team',
      'createdAt',
      'resolvedAt',
    ].join(',');

    const rows = tickets.map((t) =>
      [
        escape(t.number),
        escape(t.title),
        escape(t.status.code),
        escape(t.priority?.code ?? ''),
        escape(t.type.code),
        escape(t.channel ?? 'web'),
        escape(t.location?.name ?? ''),
        escape(t.location?.site ?? ''),
        escape(person(t.requester)),
        escape(person(t.assignee)),
        escape(t.team?.name ?? ''),
        escape(t.createdAt.toISOString()),
        escape(t.resolvedAt?.toISOString() ?? ''),
      ].join(','),
    );

    return `${header}\n${rows.join('\n')}`;
  }

  async get(user: AuthUserView, idOrNumber: string) {
    const ticket = await this.findAccessible(user, idOrNumber, true);
    const allowedTransitions = await this.listAllowedTransitions(user, ticket);
    const watching = !!(await this.prisma.ticketWatcher.findUnique({
      where: {
        ticketId_userId: { ticketId: ticket.id, userId: user.id },
      },
      select: { userId: true },
    }));
    const serialized = this.serialize(ticket, user);
    return {
      ...serialized,
      history: await this.decorateHistory(
        Array.isArray(serialized.history) ? serialized.history : [],
      ),
      watching,
      allowedTransitions,
      canSoftDelete: this.canSoftDelete(user),
    };
  }

  async softDelete(user: AuthUserView, idOrNumber: string) {
    if (!this.canSoftDelete(user)) {
      throw new ForbiddenException('Cannot delete tickets');
    }
    const ticket = await this.findAccessible(user, idOrNumber, false);
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log({
      actorId: user.id,
      action: 'ticket.soft_delete',
      entityType: 'ticket',
      entityId: ticket.id,
      after: { number: ticket.number },
    });
    return { ok: true, number: ticket.number };
  }

  private async listAllowedTransitions(
    user: AuthUserView,
    ticket: { statusId: string; status: { code: string }; requesterId: string },
  ) {
    const rows = await this.prisma.ticketStatusTransition.findMany({
      where: { fromStatusId: ticket.statusId },
      include: { toStatus: true },
      orderBy: { toStatus: { sortOrder: 'asc' } },
    });

    const isStaff = this.canStaffTickets(user);
    const isRequester = ticket.requesterId === user.id;

    return rows
      .filter((r) => {
        if (isStaff) return true;
        if (!isRequester) return false;
        return (
          r.toStatus.code === 'cancelled' ||
          (ticket.status.code === 'resolved' && r.toStatus.code === 'closed')
        );
      })
      .map((r) => ({
        code: r.toStatus.code,
        name: r.toStatus.name,
        isTerminal: r.toStatus.isTerminal,
      }));
  }

  async update(user: AuthUserView, idOrNumber: string, dto: UpdateTicketDto) {
    const existing = await this.findAccessible(user, idOrNumber, false);

    if (
      existing.requesterId !== user.id &&
      !user.permissions.includes(PERMISSIONS.TICKETS_WRITE)
    ) {
      throw new ForbiddenException('Cannot update this ticket');
    }

    if (existing.version !== dto.version) {
      throw new ConflictException(
        'Ticket was modified by someone else. Reload and try again.',
      );
    }

    const data: Prisma.TicketUpdateInput = {
      version: { increment: 1 },
    };
    const history: Prisma.TicketHistoryCreateManyTicketInput[] = [];

    if (dto.title && dto.title !== existing.title) {
      data.title = dto.title.trim();
      history.push({
        actorId: user.id,
        field: 'title',
        oldValue: existing.title,
        newValue: dto.title.trim(),
      });
    }

    if (dto.description && dto.description !== existing.description) {
      data.description = dto.description.trim();
      history.push({
        actorId: user.id,
        field: 'description',
        oldValue: existing.description,
        newValue: dto.description.trim(),
      });
    }

    if (dto.statusCode) {
      const next = await this.prisma.ticketStatus.findUnique({
        where: { code: dto.statusCode },
      });
      if (!next) throw new BadRequestException('Invalid status');

      const allowed = await this.prisma.ticketStatusTransition.findUnique({
        where: {
          fromStatusId_toStatusId: {
            fromStatusId: existing.statusId,
            toStatusId: next.id,
          },
        },
      });
      if (!allowed) {
        throw new BadRequestException(
          `Invalid status transition to ${dto.statusCode}`,
        );
      }

      const isStaff = this.canStaffTickets(user);
      const isRequester = existing.requesterId === user.id;
      const requesterAllowed =
        isRequester &&
        (next.code === 'cancelled' ||
          (existing.status.code === 'resolved' && next.code === 'closed'));

      if (!isStaff && !requesterAllowed) {
        throw new ForbiddenException('Cannot change ticket status');
      }

      data.status = { connect: { id: next.id } };
      history.push({
        actorId: user.id,
        field: 'status',
        oldValue: existing.status.code,
        newValue: next.code,
      });

      if (next.code === 'resolved') data.resolvedAt = new Date();
      if (next.code === 'closed') data.closedAt = new Date();
      if (next.code === 'open' && existing.status.code !== 'open') {
        data.resolvedAt = null;
        data.closedAt = null;
      }
    }

    if (dto.impact || dto.urgency) {
      const impact = dto.impact ?? existing.impact ?? 'medium';
      const urgency = dto.urgency ?? existing.urgency ?? 'medium';
      data.impact = impact;
      data.urgency = urgency;

      if (!dto.priorityOverride && !dto.priorityCode) {
        const priority = await this.resolvePriority(impact, urgency);
        if (priority) {
          data.priority = { connect: { id: priority.id } };
          data.priorityOverride = false;
          history.push({
            actorId: user.id,
            field: 'priority',
            oldValue: existing.priority?.code,
            newValue: priority.code,
          });
        }
      }
    }

    if (dto.priorityCode) {
      if (!this.canReadAll(user)) {
        throw new ForbiddenException('Cannot override priority');
      }
      const priority = await this.prisma.priority.findUnique({
        where: { code: dto.priorityCode },
      });
      if (!priority) throw new BadRequestException('Invalid priority');
      data.priority = { connect: { id: priority.id } };
      data.priorityOverride = dto.priorityOverride ?? true;
      history.push({
        actorId: user.id,
        field: 'priority',
        oldValue: existing.priority?.code,
        newValue: priority.code,
      });
    }

    if (dto.assigneeId !== undefined) {
      if (!user.permissions.includes(PERMISSIONS.TICKETS_ASSIGN)) {
        throw new ForbiddenException('Cannot assign tickets');
      }
      const nextAssignee =
        dto.assigneeId === null || dto.assigneeId === ''
          ? null
          : dto.assigneeId;
      if (nextAssignee !== existing.assigneeId) {
        data.assignee = nextAssignee
          ? { connect: { id: nextAssignee } }
          : { disconnect: true };
        history.push({
          actorId: user.id,
          field: 'assignee',
          oldValue: existing.assigneeId,
          newValue: nextAssignee,
        });
      }
    }

    if (dto.teamId !== undefined) {
      if (!user.permissions.includes(PERMISSIONS.TICKETS_ASSIGN)) {
        throw new ForbiddenException('Cannot assign tickets');
      }
      const nextTeam =
        dto.teamId === null || dto.teamId === '' ? null : dto.teamId;
      if (nextTeam !== existing.teamId) {
        data.team = nextTeam
          ? { connect: { id: nextTeam } }
          : { disconnect: true };
        history.push({
          actorId: user.id,
          field: 'team',
          oldValue: existing.teamId,
          newValue: nextTeam,
        });
      }
    }

    if (dto.locationId !== undefined) {
      if (!this.canStaffTickets(user)) {
        throw new ForbiddenException('Cannot change ticket location');
      }
      let nextLoc: string | null =
        dto.locationId === null || dto.locationId.trim() === ''
          ? null
          : dto.locationId.trim();
      // Empty selection → fall back to the requester's home location.
      if (!nextLoc) {
        const requester = await this.prisma.user.findFirst({
          where: { id: existing.requesterId },
          select: { locationId: true },
        });
        nextLoc = requester?.locationId ?? null;
      }
      if (nextLoc) {
        const loc = await this.prisma.location.findFirst({
          where: { id: nextLoc, deletedAt: null },
        });
        if (!loc) throw new BadRequestException('Location not found');
        data.location = { connect: { id: loc.id } };
        nextLoc = loc.id;
      } else {
        data.location = { disconnect: true };
      }
      history.push({
        actorId: user.id,
        field: 'location',
        oldValue: existing.locationId,
        newValue: nextLoc,
      });
    }

    if (dto.majorIncident !== undefined) {
      if (!this.canStaffTickets(user)) {
        throw new ForbiddenException('Cannot set major incident flag');
      }
      if (dto.majorIncident !== existing.majorIncident) {
        data.majorIncident = dto.majorIncident;
        history.push({
          actorId: user.id,
          field: 'major_incident',
          oldValue: String(existing.majorIncident),
          newValue: String(dto.majorIncident),
        });
      }
    }

    if (dto.restricted !== undefined) {
      if (!user.permissions.includes(PERMISSIONS.TICKETS_WRITE)) {
        throw new ForbiddenException('Cannot set restricted flag');
      }
      if (dto.restricted !== existing.restricted) {
        data.restricted = dto.restricted;
        history.push({
          actorId: user.id,
          field: 'restricted',
          oldValue: String(existing.restricted),
          newValue: String(dto.restricted),
        });
      }
    }

    if (dto.resolutionCodeId !== undefined) {
      if (!this.canStaffTickets(user)) {
        throw new ForbiddenException('Cannot set resolution code');
      }
      const nextId =
        dto.resolutionCodeId === null || dto.resolutionCodeId === ''
          ? null
          : dto.resolutionCodeId;
      if (nextId) {
        const code = await this.prisma.resolutionCode.findFirst({
          where: { id: nextId, isActive: true },
        });
        if (!code) throw new BadRequestException('Invalid resolution code');
        data.resolutionCode = { connect: { id: code.id } };
      } else {
        data.resolutionCode = { disconnect: true };
      }
      history.push({
        actorId: user.id,
        field: 'resolution_code',
        oldValue: existing.resolutionCodeId,
        newValue: nextId,
      });
    }

    if (dto.rootCause !== undefined || dto.workaround !== undefined) {
      if (!this.canStaffTickets(user)) {
        throw new ForbiddenException('Cannot update problem analysis fields');
      }
      if (dto.rootCause !== undefined) {
        const next =
          dto.rootCause === null ? null : dto.rootCause.trim() || null;
        if (next !== existing.rootCause) {
          data.rootCause = next;
          history.push({
            actorId: user.id,
            field: 'root_cause',
            oldValue: existing.rootCause,
            newValue: next,
          });
        }
      }
      if (dto.workaround !== undefined) {
        const next =
          dto.workaround === null ? null : dto.workaround.trim() || null;
        if (next !== existing.workaround) {
          data.workaround = next;
          history.push({
            actorId: user.id,
            field: 'workaround',
            oldValue: existing.workaround,
            newValue: next,
          });
        }
      }
    }

    if (
      dto.changeRisk !== undefined ||
      dto.changePlan !== undefined ||
      dto.rollbackPlan !== undefined ||
      dto.scheduledStart !== undefined ||
      dto.scheduledEnd !== undefined ||
      dto.cabRequired !== undefined
    ) {
      if (!this.canStaffTickets(user)) {
        throw new ForbiddenException('Cannot update change plan fields');
      }
      if (dto.changeRisk !== undefined) {
        const next =
          dto.changeRisk === null ? null : dto.changeRisk.trim() || null;
        if (next !== existing.changeRisk) {
          data.changeRisk = next;
          history.push({
            actorId: user.id,
            field: 'change_risk',
            oldValue: existing.changeRisk,
            newValue: next,
          });
        }
      }
      if (dto.changePlan !== undefined) {
        const next =
          dto.changePlan === null ? null : dto.changePlan.trim() || null;
        if (next !== existing.changePlan) {
          data.changePlan = next;
          history.push({
            actorId: user.id,
            field: 'change_plan',
            oldValue: existing.changePlan ? '(updated)' : null,
            newValue: next ? '(set)' : null,
          });
        }
      }
      if (dto.rollbackPlan !== undefined) {
        const next =
          dto.rollbackPlan === null ? null : dto.rollbackPlan.trim() || null;
        if (next !== existing.rollbackPlan) {
          data.rollbackPlan = next;
          history.push({
            actorId: user.id,
            field: 'rollback_plan',
            oldValue: existing.rollbackPlan ? '(updated)' : null,
            newValue: next ? '(set)' : null,
          });
        }
      }
      if (dto.scheduledStart !== undefined) {
        const next = dto.scheduledStart
          ? new Date(dto.scheduledStart)
          : null;
        if (next && Number.isNaN(next.getTime())) {
          throw new BadRequestException('Invalid scheduledStart');
        }
        const prev = existing.scheduledStart?.toISOString() ?? null;
        const nextIso = next?.toISOString() ?? null;
        if (prev !== nextIso) {
          data.scheduledStart = next;
          history.push({
            actorId: user.id,
            field: 'scheduled_start',
            oldValue: prev,
            newValue: nextIso,
          });
        }
      }
      if (dto.scheduledEnd !== undefined) {
        const next = dto.scheduledEnd ? new Date(dto.scheduledEnd) : null;
        if (next && Number.isNaN(next.getTime())) {
          throw new BadRequestException('Invalid scheduledEnd');
        }
        const prev = existing.scheduledEnd?.toISOString() ?? null;
        const nextIso = next?.toISOString() ?? null;
        if (prev !== nextIso) {
          data.scheduledEnd = next;
          history.push({
            actorId: user.id,
            field: 'scheduled_end',
            oldValue: prev,
            newValue: nextIso,
          });
        }
      }
      if (
        dto.cabRequired !== undefined &&
        dto.cabRequired !== existing.cabRequired
      ) {
        data.cabRequired = dto.cabRequired;
        history.push({
          actorId: user.id,
          field: 'cab_required',
          oldValue: String(existing.cabRequired),
          newValue: String(dto.cabRequired),
        });
      }
    }

    if (dto.categoryCode) {
      const category = await this.prisma.category.findFirst({
        where: { code: dto.categoryCode, deletedAt: null },
      });
      if (!category) throw new BadRequestException('Invalid category');
      data.category = { connect: { id: category.id } };
    }

    const ticket = await this.prisma.ticket.update({
      where: { id: existing.id },
      data: {
        ...data,
        history: history.length ? { create: history } : undefined,
      },
      include: this.defaultInclude(true),
    });

    if (dto.assigneeId && dto.assigneeId !== existing.assigneeId) {
      await this.notifications.notify({
        userId: dto.assigneeId,
        eventType: 'ticket.assigned',
        title: `Assigned ${ticket.number}`,
        body: ticket.title,
        link: `/app/tickets/${ticket.number}`,
        email: { ticketNumber: ticket.number, eventLabel: 'Assigned to you' },
      });
    }

    if (dto.statusCode && dto.statusCode !== existing.status.code) {
      const eventType = statusChangeEventType(dto.statusCode);
      const eventLabel = statusChangeLabel(dto.statusCode);
      const statusRecipients = new Set<string>([ticket.requesterId]);
      if (ticket.assigneeId) statusRecipients.add(ticket.assigneeId);
      statusRecipients.delete(user.id);
      for (const userId of statusRecipients) {
        await this.notifications.notify({
          userId,
          eventType,
          title: `${ticket.number} · ${eventLabel}`,
          body: `${ticket.title} (${existing.status.code} → ${dto.statusCode})`,
          link: `/app/tickets/${ticket.number}`,
          email: {
            ticketNumber: ticket.number,
            eventLabel,
          },
        });
      }
      await this.notifyWatchers({
        ticketId: ticket.id,
        actorId: user.id,
        alreadyNotified: statusRecipients,
        eventType,
        title: `${ticket.number} · ${eventLabel}`,
        body: `${ticket.title} (${existing.status.code} → ${dto.statusCode})`,
        link: `/app/tickets/${ticket.number}`,
        email: {
          ticketNumber: ticket.number,
          eventLabel,
        },
      });
    }

    const changedFields = history.map((h) => h.field);
    if (changedFields.length > 0) {
      this.webhooks.emit('ticket.updated', {
        ticket: {
          id: ticket.id,
          number: ticket.number,
          title: ticket.title,
          statusCode: ticket.status?.code ?? null,
          priorityCode: ticket.priority?.code ?? null,
          typeCode: ticket.type?.code ?? null,
          requesterId: ticket.requesterId,
          assigneeId: ticket.assigneeId,
          teamId: ticket.teamId,
          isMajorIncident: ticket.majorIncident,
        },
        actorId: user.id,
        changedFields,
        previousStatusCode: existing.status.code,
      });
    }
    if (dto.assigneeId && dto.assigneeId !== existing.assigneeId) {
      this.webhooks.emit('ticket.assigned', {
        ticket: {
          id: ticket.id,
          number: ticket.number,
          title: ticket.title,
          assigneeId: dto.assigneeId,
        },
        actorId: user.id,
        previousAssigneeId: existing.assigneeId,
      });
    }

    const allowedTransitions = await this.listAllowedTransitions(user, ticket);
    return {
      ...this.serialize(ticket, user),
      allowedTransitions,
      canSoftDelete: this.canSoftDelete(user),
    };
  }

  async addComment(
    user: AuthUserView,
    idOrNumber: string,
    dto: AddCommentDto,
  ) {
    const ticket = await this.findAccessible(user, idOrNumber, false);
    const isInternal = !!dto.isInternal;

    if (isInternal && !this.canInternalNote(user)) {
      throw new ForbiddenException('Cannot add internal notes');
    }

    if (
      ticket.requesterId !== user.id &&
      !user.permissions.includes(PERMISSIONS.TICKETS_WRITE)
    ) {
      throw new ForbiddenException('Cannot comment on this ticket');
    }

    const comment = await this.prisma.ticketComment.create({
      data: {
        ticketId: ticket.id,
        authorId: user.id,
        body: dto.body.trim(),
        isInternal,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!ticket.firstResponseAt && ticket.requesterId !== user.id) {
      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { firstResponseAt: new Date() },
      });
    }

    await this.prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        actorId: user.id,
        field: isInternal ? 'internal_note' : 'comment',
        newValue: comment.id,
      },
    });

    if (!isInternal) {
      const recipients = new Set<string>();
      if (ticket.requesterId !== user.id) recipients.add(ticket.requesterId);
      if (ticket.assigneeId && ticket.assigneeId !== user.id) {
        recipients.add(ticket.assigneeId);
      }
      const preview =
        dto.body.trim().length > 280
          ? `${dto.body.trim().slice(0, 277)}…`
          : dto.body.trim();
      for (const userId of recipients) {
        await this.notifications.notify({
          userId,
          eventType: 'ticket.comment',
          title: `Comment on ${ticket.number}`,
          body: preview,
          link: `/app/tickets/${ticket.number}`,
          email: {
            ticketNumber: ticket.number,
            eventLabel: 'New comment',
          },
        });
      }
      await this.notifyWatchers({
        ticketId: ticket.id,
        actorId: user.id,
        alreadyNotified: recipients,
        eventType: 'ticket.comment',
        title: `Comment on ${ticket.number}`,
        body: preview,
        link: `/app/tickets/${ticket.number}`,
        email: {
          ticketNumber: ticket.number,
          eventLabel: 'New comment',
        },
      });
      this.webhooks.emit('ticket.commented', {
        ticket: {
          id: ticket.id,
          number: ticket.number,
          title: ticket.title,
        },
        comment: {
          id: comment.id,
          body: preview,
          isInternal: false,
          authorId: user.id,
        },
        actorId: user.id,
      });
    }

    return comment;
  }

  async watch(user: AuthUserView, idOrNumber: string) {
    const ticket = await this.findAccessible(user, idOrNumber, false);
    await this.prisma.ticketWatcher.upsert({
      where: {
        ticketId_userId: { ticketId: ticket.id, userId: user.id },
      },
      create: { ticketId: ticket.id, userId: user.id },
      update: {},
    });
    return { watching: true };
  }

  async unwatch(user: AuthUserView, idOrNumber: string) {
    const ticket = await this.findAccessible(user, idOrNumber, false);
    await this.prisma.ticketWatcher.deleteMany({
      where: { ticketId: ticket.id, userId: user.id },
    });
    return { watching: false };
  }

  async heartbeatPresence(
    user: AuthUserView,
    idOrNumber: string,
    mode: 'viewing' | 'composing' = 'viewing',
  ) {
    const ticket = await this.findAccessible(user, idOrNumber, false);
    const result = await this.presence.heartbeat(
      ticket.id,
      {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
      mode,
    );
    const composingOthers = result.peers.filter((p) => p.mode === 'composing');
    return {
      ticketId: ticket.id,
      number: ticket.number,
      peers: result.peers,
      self: result.self,
      collision: composingOthers.length > 0,
      composingPeers: composingOthers,
    };
  }

  async listPresence(user: AuthUserView, idOrNumber: string) {
    const ticket = await this.findAccessible(user, idOrNumber, false);
    const peers = await this.presence.list(ticket.id, user.id);
    const composingPeers = peers.filter((p) => p.mode === 'composing');
    return {
      ticketId: ticket.id,
      number: ticket.number,
      peers,
      collision: composingPeers.length > 0,
      composingPeers,
    };
  }

  async leavePresence(user: AuthUserView, idOrNumber: string) {
    const ticket = await this.findAccessible(user, idOrNumber, false);
    await this.presence.leave(ticket.id, user.id);
    return { ok: true };
  }

  async addWorkLog(
    user: AuthUserView,
    idOrNumber: string,
    dto: AddWorkLogDto,
  ) {
    if (!user.permissions.includes(PERMISSIONS.TICKETS_WRITE)) {
      throw new ForbiddenException('Cannot log work on this ticket');
    }
    if (!this.canStaffTickets(user)) {
      throw new ForbiddenException('Only agents can log work');
    }

    const ticket = await this.findAccessible(user, idOrNumber, false);
    const log = await this.prisma.ticketWorkLog.create({
      data: {
        ticketId: ticket.id,
        authorId: user.id,
        minutes: dto.minutes,
        note: dto.note?.trim() || null,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    await this.prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        actorId: user.id,
        field: 'work_log',
        newValue: `${dto.minutes}m`,
      },
    });

    return log;
  }

  async listWorkLogs(user: AuthUserView, idOrNumber: string) {
    const ticket = await this.findAccessible(user, idOrNumber, false);
    if (!this.canStaffTickets(user) && ticket.requesterId !== user.id) {
      throw new ForbiddenException('Cannot view work logs');
    }

    return this.prisma.ticketWorkLog.findMany({
      where: { ticketId: ticket.id },
      orderBy: { workedAt: 'desc' },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async linkChild(
    user: AuthUserView,
    parentIdOrNumber: string,
    childNumber: string,
  ) {
    if (!user.permissions.includes(PERMISSIONS.TICKETS_WRITE)) {
      throw new ForbiddenException('Cannot link tickets');
    }
    if (!this.canStaffTickets(user)) {
      throw new ForbiddenException('Only agents can link parent/child tickets');
    }

    const parent = await this.findAccessible(user, parentIdOrNumber, false);
    const child = await this.prisma.ticket.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id: childNumber.trim() }, { number: childNumber.trim() }],
      },
    });
    if (!child) throw new NotFoundException('Child ticket not found');
    if (child.id === parent.id) {
      throw new BadRequestException('Ticket cannot be its own parent');
    }
    if (child.parentId === parent.id) {
      return this.get(user, parent.id);
    }

    // Prevent cycles: walk from parent upward; child must not be an ancestor.
    let cursor: string | null = parent.parentId;
    const seen = new Set<string>([parent.id]);
    while (cursor) {
      if (cursor === child.id) {
        throw new BadRequestException(
          'Link would create a cycle in the ticket hierarchy',
        );
      }
      if (seen.has(cursor)) break;
      seen.add(cursor);
      const up = await this.prisma.ticket.findFirst({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = up?.parentId ?? null;
    }

    await this.prisma.ticket.update({
      where: { id: child.id },
      data: {
        parentId: parent.id,
        history: {
          create: {
            actorId: user.id,
            field: 'parent',
            oldValue: child.parentId,
            newValue: parent.number,
          },
        },
      },
    });

    await this.prisma.ticketHistory.create({
      data: {
        ticketId: parent.id,
        actorId: user.id,
        field: 'child_linked',
        newValue: child.number,
      },
    });

    await this.audit.log({
      actorId: user.id,
      action: 'ticket.link_child',
      entityType: 'ticket',
      entityId: parent.id,
      after: { parent: parent.number, child: child.number },
    });

    return this.get(user, parent.id);
  }

  /**
   * Raise a Problem (PRB) from an incident/security ticket and link the source as a child.
   */
  async promoteToProblem(user: AuthUserView, idOrNumber: string) {
    if (!user.permissions.includes(PERMISSIONS.TICKETS_WRITE)) {
      throw new ForbiddenException('Cannot create problems');
    }
    if (!this.canStaffTickets(user)) {
      throw new ForbiddenException('Only agents can raise problems');
    }

    const source = await this.findAccessible(user, idOrNumber, false);
    if (source.type.code === 'problem') {
      throw new BadRequestException('Ticket is already a problem');
    }
    if (source.type.code === 'change' || source.type.code === 'task') {
      throw new BadRequestException(
        'Only incidents / requests can be promoted to a problem',
      );
    }

    if (source.parentId) {
      const parent = await this.prisma.ticket.findFirst({
        where: { id: source.parentId, deletedAt: null },
        include: { type: true },
      });
      if (parent?.type.code === 'problem') {
        return this.get(user, parent.id);
      }
    }

    const [problemType, status] = await Promise.all([
      this.prisma.ticketType.findUnique({ where: { code: 'problem' } }),
      this.prisma.ticketStatus.findUnique({
        where: { code: 'under_investigation' },
      }),
    ]);
    if (!problemType) {
      throw new BadRequestException('Problem ticket type is not configured');
    }
    const statusId =
      status?.id ??
      (
        await this.prisma.ticketStatus.findUnique({
          where: { code: 'open' },
        })
      )?.id;
    if (!statusId) throw new BadRequestException('No status available');

    const number = await this.nextNumber(problemType.prefix);
    const title = `Problem: ${source.title}`.slice(0, 200);

    const problem = await this.prisma.ticket.create({
      data: {
        number,
        title,
        description: `Raised from ${source.number}.\n\n${source.description}`,
        typeId: problemType.id,
        statusId,
        priorityId: source.priorityId ?? undefined,
        categoryId: source.categoryId ?? undefined,
        subcategoryId: source.subcategoryId ?? undefined,
        impact: source.impact,
        urgency: source.urgency,
        requesterId: source.requesterId,
        departmentId: source.departmentId,
        locationId: source.locationId,
        teamId: source.teamId ?? undefined,
        assigneeId: source.assigneeId ?? undefined,
        channel: 'web',
        channelMeta: {
          promotedFrom: source.number,
          sourceChannel: source.channel ?? 'web',
        },
        history: {
          create: [
            {
              actorId: user.id,
              field: 'created',
              newValue: number,
            },
            {
              actorId: user.id,
              field: 'promoted_from',
              newValue: source.number,
            },
            ...(source.teamId
              ? [
                  {
                    actorId: user.id,
                    field: 'team',
                    newValue: source.teamId,
                  },
                ]
              : []),
            ...(source.assigneeId
              ? [
                  {
                    actorId: user.id,
                    field: 'assignee',
                    newValue: source.assigneeId,
                  },
                ]
              : []),
          ],
        },
      },
    });

    await this.prisma.ticket.update({
      where: { id: source.id },
      data: {
        parentId: problem.id,
        history: {
          create: {
            actorId: user.id,
            field: 'parent',
            oldValue: source.parentId,
            newValue: number,
          },
        },
      },
    });

    await this.prisma.ticketHistory.create({
      data: {
        ticketId: problem.id,
        actorId: user.id,
        field: 'child_linked',
        newValue: source.number,
      },
    });

    await this.sla.createForTicket(problem.id, source.priorityId ?? undefined);
    await this.audit.log({
      actorId: user.id,
      action: 'ticket.promote_problem',
      entityType: 'ticket',
      entityId: problem.id,
      after: { problem: number, from: source.number },
    });

    return this.get(user, problem.id);
  }

  /** Submit a change to CAB / approvers (pending_approval + approval rows). */
  async requestCab(user: AuthUserView, idOrNumber: string) {
    if (!user.permissions.includes(PERMISSIONS.TICKETS_WRITE)) {
      throw new ForbiddenException('Cannot submit change for CAB');
    }
    if (!this.canStaffTickets(user)) {
      throw new ForbiddenException('Only agents can submit CAB reviews');
    }

    const ticket = await this.findAccessible(user, idOrNumber, false);
    if (ticket.type.code !== 'change') {
      throw new BadRequestException('CAB review applies to change tickets only');
    }
    if (ticket.status.code === 'pending_approval') {
      throw new BadRequestException('Change is already pending CAB approval');
    }
    if (ticket.status.isTerminal) {
      throw new BadRequestException('Cannot submit a closed change to CAB');
    }

    const pendingStatus = await this.prisma.ticketStatus.findUnique({
      where: { code: 'pending_approval' },
    });
    if (!pendingStatus) {
      throw new BadRequestException('pending_approval status is not configured');
    }

    const allowed = await this.prisma.ticketStatusTransition.findUnique({
      where: {
        fromStatusId_toStatusId: {
          fromStatusId: ticket.statusId,
          toStatusId: pendingStatus.id,
        },
      },
    });
    if (!allowed) {
      throw new BadRequestException(
        `Cannot move from ${ticket.status.code} to pending approval`,
      );
    }

    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        statusId: pendingStatus.id,
        cabRequired: true,
        version: { increment: 1 },
        history: {
          create: [
            {
              actorId: user.id,
              field: 'status',
              oldValue: ticket.status.code,
              newValue: 'pending_approval',
            },
            {
              actorId: user.id,
              field: 'cab_requested',
              newValue: 'pending',
            },
          ],
        },
      },
    });

    await this.approvals.createForTicket(ticket.id, ticket.title, ticket.number);
    await this.audit.log({
      actorId: user.id,
      action: 'ticket.cab_requested',
      entityType: 'ticket',
      entityId: ticket.id,
      after: { number: ticket.number },
    });

    return this.get(user, ticket.id);
  }

  async unlinkChild(
    user: AuthUserView,
    parentIdOrNumber: string,
    childIdOrNumber: string,
  ) {
    if (!user.permissions.includes(PERMISSIONS.TICKETS_WRITE)) {
      throw new ForbiddenException('Cannot unlink tickets');
    }
    if (!this.canStaffTickets(user)) {
      throw new ForbiddenException('Only agents can unlink parent/child tickets');
    }

    const parent = await this.findAccessible(user, parentIdOrNumber, false);
    const child = await this.prisma.ticket.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id: childIdOrNumber }, { number: childIdOrNumber }],
      },
    });
    if (!child) throw new NotFoundException('Child ticket not found');
    if (child.parentId !== parent.id) {
      throw new BadRequestException('Ticket is not a child of this parent');
    }

    await this.prisma.ticket.update({
      where: { id: child.id },
      data: {
        parentId: null,
        history: {
          create: {
            actorId: user.id,
            field: 'parent',
            oldValue: parent.number,
            newValue: null,
          },
        },
      },
    });

    await this.prisma.ticketHistory.create({
      data: {
        ticketId: parent.id,
        actorId: user.id,
        field: 'child_unlinked',
        newValue: child.number,
      },
    });

    await this.audit.log({
      actorId: user.id,
      action: 'ticket.unlink_child',
      entityType: 'ticket',
      entityId: parent.id,
      after: { parent: parent.number, child: child.number },
    });

    return this.get(user, parent.id);
  }

  /**
   * Merge source tickets into a primary (target). Sources keep their numbers,
   * gain status `merged` + mergedIntoId, and comments/attachments are copied
   * onto the primary with attribution. Children of sources are reparented.
   */
  async merge(
    user: AuthUserView,
    targetIdOrNumber: string,
    sourceTicketIds: string[],
  ) {
    const canMerge =
      user.permissions.includes(PERMISSIONS.TICKETS_WRITE) ||
      user.permissions.includes(PERMISSIONS.TICKETS_ASSIGN);
    if (!canMerge) {
      throw new ForbiddenException('Cannot merge tickets');
    }
    if (!this.canStaffTickets(user)) {
      throw new ForbiddenException('Only agents can merge tickets');
    }

    const refs = [
      ...new Set(
        sourceTicketIds
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      ),
    ];
    if (refs.length === 0) {
      throw new BadRequestException('Provide at least one source ticket');
    }

    const primary = await this.findAccessible(user, targetIdOrNumber, false);
    if (primary.mergedIntoId) {
      throw new BadRequestException(
        'Cannot merge into a ticket that was already merged elsewhere',
      );
    }
    if (primary.status.code === 'merged') {
      throw new BadRequestException('Primary ticket is already marked merged');
    }

    const mergedStatus = await this.prisma.ticketStatus.findUnique({
      where: { code: 'merged' },
    });
    if (!mergedStatus) {
      throw new BadRequestException(
        'Merged status is not configured; run migrations/seed',
      );
    }

    const sources = await this.prisma.ticket.findMany({
      where: {
        deletedAt: null,
        OR: refs.flatMap((r) => [{ id: r }, { number: r }]),
      },
      include: {
        status: true,
        comments: {
          orderBy: { createdAt: 'asc' },
        },
        attachments: true,
        children: {
          where: { deletedAt: null },
          select: { id: true, number: true },
        },
      },
    });

    if (sources.length === 0) {
      throw new NotFoundException('No source tickets found');
    }

    const foundKeys = new Set<string>();
    for (const s of sources) {
      foundKeys.add(s.id);
      foundKeys.add(s.number);
    }
    const missing = refs.filter((r) => !foundKeys.has(r));
    if (missing.length > 0) {
      throw new NotFoundException(
        `Source ticket(s) not found: ${missing.join(', ')}`,
      );
    }

    for (const source of sources) {
      if (source.id === primary.id) {
        throw new BadRequestException('Cannot merge a ticket into itself');
      }
      if (source.mergedIntoId || source.status.code === 'merged') {
        throw new BadRequestException(
          `Ticket ${source.number} is already merged`,
        );
      }
    }

    const now = new Date();
    const mergedNumbers: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const source of sources) {
        mergedNumbers.push(source.number);

        // Reparent children of the source onto the primary.
        if (source.children.length > 0) {
          await tx.ticket.updateMany({
            where: { id: { in: source.children.map((c) => c.id) } },
            data: { parentId: primary.id },
          });
          for (const child of source.children) {
            await tx.ticketHistory.create({
              data: {
                ticketId: child.id,
                actorId: user.id,
                field: 'parent',
                oldValue: source.number,
                newValue: primary.number,
              },
            });
          }
        }

        await tx.ticket.update({
          where: { id: source.id },
          data: {
            mergedIntoId: primary.id,
            parentId: null,
            statusId: mergedStatus.id,
            closedAt: now,
            version: { increment: 1 },
            history: {
              create: [
                {
                  actorId: user.id,
                  field: 'status',
                  oldValue: source.status.code,
                  newValue: 'merged',
                },
                {
                  actorId: user.id,
                  field: 'merged_into',
                  oldValue: null,
                  newValue: primary.number,
                },
              ],
            },
          },
        });

        await tx.slaInstance.updateMany({
          where: { ticketId: source.id, completedAt: null },
          data: { completedAt: now, percentConsumed: 100 },
        });

        // Copy comments onto primary with attribution (retain visibility).
        for (const c of source.comments) {
          await tx.ticketComment.create({
            data: {
              ticketId: primary.id,
              authorId: c.authorId,
              isInternal: c.isInternal,
              body: `[Merged from ${source.number}] ${c.body}`,
              createdAt: c.createdAt,
            },
          });
        }

        // Link attachments onto primary (same stored files).
        for (const a of source.attachments) {
          await tx.ticketAttachment.create({
            data: {
              ticketId: primary.id,
              uploadedById: a.uploadedById,
              originalName: a.originalName,
              storedName: a.storedName,
              mimeType: a.mimeType,
              sizeBytes: a.sizeBytes,
              createdAt: a.createdAt,
            },
          });
        }

        await tx.ticketHistory.create({
          data: {
            ticketId: primary.id,
            actorId: user.id,
            field: 'merged_from',
            newValue: source.number,
          },
        });
      }

      const summary =
        `Merged ${mergedNumbers.join(', ')} into this ticket. ` +
        `Comments and attachments were copied with attribution; ` +
        `source tickets are closed as Merged and retain their numbers.`;

      await tx.ticketComment.create({
        data: {
          ticketId: primary.id,
          authorId: user.id,
          isInternal: true,
          body: summary,
        },
      });

      await tx.ticketHistory.create({
        data: {
          ticketId: primary.id,
          actorId: user.id,
          field: 'merge',
          newValue: mergedNumbers.join(','),
        },
      });

      await tx.ticket.update({
        where: { id: primary.id },
        data: { version: { increment: 1 } },
      });
    });

    await this.audit.log({
      actorId: user.id,
      action: 'ticket.merge',
      entityType: 'ticket',
      entityId: primary.id,
      after: {
        primary: primary.number,
        sources: mergedNumbers,
      },
    });

    return this.get(user, primary.id);
  }

  listSavedViews(user: AuthUserView) {
    return this.prisma.ticketSavedView.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
    });
  }

  createSavedView(user: AuthUserView, dto: CreateSavedViewDto) {
    return this.prisma.ticketSavedView.create({
      data: {
        userId: user.id,
        name: dto.name.trim(),
        queryJson: dto.queryJson as Prisma.InputJsonValue,
      },
    });
  }

  async updateSavedView(
    user: AuthUserView,
    id: string,
    dto: UpdateSavedViewDto,
  ) {
    const existing = await this.prisma.ticketSavedView.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) throw new NotFoundException('Saved view not found');
    return this.prisma.ticketSavedView.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.queryJson !== undefined
          ? { queryJson: dto.queryJson as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  async deleteSavedView(user: AuthUserView, id: string) {
    const existing = await this.prisma.ticketSavedView.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) throw new NotFoundException('Saved view not found');
    await this.prisma.ticketSavedView.delete({ where: { id } });
    return { ok: true };
  }

  async meta() {
    const [
      types,
      statuses,
      categories,
      priorities,
      matrix,
      locations,
      resolutionCodes,
    ] = await Promise.all([
      this.prisma.ticketType.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.ticketStatus.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.category.findMany({
        where: { deletedAt: null, isActive: true },
        include: {
          subcategories: {
            where: { deletedAt: null, isActive: true },
            orderBy: { name: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.priority.findMany({ orderBy: { rank: 'asc' } }),
      this.prisma.priorityMatrix.findMany({
        include: { priority: true },
      }),
      this.prisma.location.findMany({
        where: { deletedAt: null, isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
          site: true,
          country: true,
          timezone: true,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.resolutionCode.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    return {
      types,
      statuses,
      categories,
      priorities,
      matrix,
      locations,
      resolutionCodes,
    };
  }

  private async findAccessible(
    user: AuthUserView,
    idOrNumber: string,
    withComments: boolean,
  ) {
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id: idOrNumber }, { number: idOrNumber }],
      },
      include: this.defaultInclude(withComments),
    });

    if (!ticket) throw new NotFoundException('Ticket not found');

    await this.assertTicketVisible(user, ticket);
    return ticket;
  }

  private defaultInclude(withComments: boolean) {
    return {
      type: true,
      status: true,
      priority: true,
      category: true,
      subcategory: true,
      resolutionCode: true,
      requester: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      assignee: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      team: { select: { id: true, code: true, name: true } },
      location: {
        select: {
          id: true,
          code: true,
          name: true,
          site: true,
          country: true,
          timezone: true,
        },
      },
      parent: withComments
        ? {
            select: {
              id: true,
              number: true,
              title: true,
              status: { select: { code: true, name: true } },
            },
          }
        : false,
      children: withComments
        ? {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' as const },
            select: {
              id: true,
              number: true,
              title: true,
              status: { select: { code: true, name: true } },
              priority: { select: { code: true, name: true } },
            },
          }
        : false,
      mergedInto: withComments
        ? {
            select: {
              id: true,
              number: true,
              title: true,
              status: { select: { code: true, name: true } },
            },
          }
        : false,
      mergedFrom: withComments
        ? {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' as const },
            select: {
              id: true,
              number: true,
              title: true,
              status: { select: { code: true, name: true } },
            },
          }
        : false,
      slaInstances: {
        orderBy: { createdAt: 'asc' as const },
        select: {
          id: true,
          metric: true,
          startedAt: true,
          dueAt: true,
          pausedAt: true,
          completedAt: true,
          breachedAt: true,
          percentConsumed: true,
        },
      },
      comments: withComments
        ? {
            orderBy: { createdAt: 'asc' as const },
            include: {
              author: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          }
        : false,
      history: withComments
        ? {
            orderBy: { createdAt: 'asc' as const },
            take: 200,
            include: {
              actor: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          }
        : false,
    };
  }

  /**
   * Time-to-resolution from active resolution SLA dueAt (fallback: ticket.dueAt).
   * Remaining is positive; overdue is negative. Paused clocks freeze at pause time.
   */
  private resolveSlaTimer(
    ticket: {
      dueAt?: Date | null;
      status?: { isTerminal?: boolean } | null;
      slaInstances?: Array<{
        metric: string;
        dueAt: Date;
        pausedAt: Date | null;
        completedAt: Date | null;
        breachedAt: Date | null;
        percentConsumed: number;
      }>;
    },
    nowMs = Date.now(),
  ) {
    const instances = ticket.slaInstances ?? [];
    const resolution =
      instances.find((i) => i.metric === 'resolution' && !i.completedAt) ??
      instances.find((i) => i.metric === 'resolution') ??
      null;

    const dueAt = resolution?.dueAt ?? ticket.dueAt ?? null;
    const completed = Boolean(resolution?.completedAt) || Boolean(ticket.status?.isTerminal);
    const paused = Boolean(resolution?.pausedAt) && !completed;
    const breached = Boolean(resolution?.breachedAt);

    if (!dueAt || completed) {
      return {
        dueAt: ticket.dueAt ?? dueAt,
        slaDueAt: dueAt,
        slaRemainingMs: null as number | null,
        slaBreached: breached,
        slaPaused: paused,
        slaCompleted: completed,
        slaPercentConsumed: resolution?.percentConsumed ?? null,
        timeToResolution: null as string | null,
      };
    }

    const refMs = paused && resolution?.pausedAt
      ? resolution.pausedAt.getTime()
      : nowMs;
    const remainingMs = dueAt.getTime() - refMs;
    const overdue = remainingMs < 0;

    return {
      dueAt: ticket.dueAt ?? dueAt,
      slaDueAt: dueAt,
      slaRemainingMs: remainingMs,
      slaBreached: breached || overdue,
      slaPaused: paused,
      slaCompleted: false,
      slaPercentConsumed: resolution?.percentConsumed ?? null,
      timeToResolution: this.formatDurationLabel(remainingMs),
    };
  }

  private computeStageDurations(
    ticket: {
      createdAt?: Date;
      status?: { code?: string; name?: string } | null;
      history?: Array<{
        field: string;
        oldValue: string | null;
        newValue: string | null;
        createdAt: Date;
      }>;
    },
    now = new Date(),
  ) {
    const history = ticket.history ?? [];
    const statusChanges = history
      .filter((h) => h.field === 'status' && h.newValue)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    type Stage = {
      statusCode: string;
      enteredAt: string;
      exitedAt: string | null;
      durationMs: number;
      current: boolean;
    };

    const stages: Stage[] = [];
    const createdAt = ticket.createdAt ?? now;

    if (statusChanges.length === 0) {
      const code = ticket.status?.code ?? 'new';
      return {
        stages: [
          {
            statusCode: code,
            enteredAt: createdAt.toISOString(),
            exitedAt: null,
            durationMs: Math.max(0, now.getTime() - createdAt.getTime()),
            current: true,
          },
        ],
        totalsByStatus: [
          {
            statusCode: code,
            durationMs: Math.max(0, now.getTime() - createdAt.getTime()),
            label: this.formatDurationLabel(
              Math.max(0, now.getTime() - createdAt.getTime()),
            ),
          },
        ],
        ticketAgeMs: Math.max(0, now.getTime() - createdAt.getTime()),
      };
    }

    let cursorCode = statusChanges[0].oldValue ?? 'new';
    let cursorAt = createdAt;

    for (const change of statusChanges) {
      const exitedAt = change.createdAt;
      const durationMs = Math.max(0, exitedAt.getTime() - cursorAt.getTime());
      stages.push({
        statusCode: cursorCode,
        enteredAt: cursorAt.toISOString(),
        exitedAt: exitedAt.toISOString(),
        durationMs,
        current: false,
      });
      cursorCode = change.newValue!;
      cursorAt = exitedAt;
    }

    stages.push({
      statusCode: ticket.status?.code ?? cursorCode,
      enteredAt: cursorAt.toISOString(),
      exitedAt: null,
      durationMs: Math.max(0, now.getTime() - cursorAt.getTime()),
      current: true,
    });

    // Collapse consecutive identical codes (defensive).
    const collapsed: Stage[] = [];
    for (const s of stages) {
      const prev = collapsed[collapsed.length - 1];
      if (prev && prev.statusCode === s.statusCode && !prev.current) {
        prev.durationMs += s.durationMs;
        prev.exitedAt = s.exitedAt;
        prev.current = s.current;
      } else {
        collapsed.push({ ...s });
      }
    }

    const byStatus = new Map<string, number>();
    for (const s of collapsed) {
      byStatus.set(s.statusCode, (byStatus.get(s.statusCode) ?? 0) + s.durationMs);
    }

    return {
      stages: collapsed,
      totalsByStatus: [...byStatus.entries()].map(([statusCode, durationMs]) => ({
        statusCode,
        durationMs,
        label: this.formatDurationLabel(durationMs),
      })),
      ticketAgeMs: ticket.createdAt
        ? Math.max(0, now.getTime() - ticket.createdAt.getTime())
        : null,
    };
  }

  private formatDurationLabel(ms: number): string {
    const sign = ms < 0 ? '-' : '';
    const abs = Math.abs(ms);
    const totalMinutes = Math.floor(abs / 60_000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
      return `${sign}${days}d ${hours}h`;
    }
    if (hours >= 1 || totalMinutes >= 60) {
      return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    return `${sign}00:${String(minutes).padStart(2, '0')}`;
  }

  private async notifyWatchers(params: {
    ticketId: string;
    actorId: string;
    alreadyNotified?: Set<string>;
    eventType: string;
    title: string;
    body: string;
    link: string;
    email?: { ticketNumber?: string; eventLabel?: string };
  }) {
    const watchers = await this.prisma.ticketWatcher.findMany({
      where: { ticketId: params.ticketId },
      select: { userId: true },
    });
    for (const { userId } of watchers) {
      if (userId === params.actorId) continue;
      if (params.alreadyNotified?.has(userId)) continue;
      await this.notifications.notify({
        userId,
        eventType: params.eventType,
        title: params.title,
        body: params.body,
        link: params.link,
        email: params.email,
      });
    }
  }

  /**
   * Resolve assignee/team/location IDs and actors into human-readable activity rows.
   */
  private async decorateHistory(
    history: Array<{
      id?: string;
      field: string;
      oldValue: string | null;
      newValue: string | null;
      createdAt: Date | string;
      actorId?: string | null;
      actor?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      } | null;
      [k: string]: unknown;
    }>,
  ) {
    const userIds = new Set<string>();
    const teamIds = new Set<string>();
    const locationIds = new Set<string>();

    for (const h of history) {
      if (h.actor?.id) userIds.add(h.actor.id);
      else if (h.actorId) userIds.add(h.actorId);
      if (h.field === 'assignee') {
        if (h.oldValue) userIds.add(h.oldValue);
        if (h.newValue) userIds.add(h.newValue);
      }
      if (h.field === 'team') {
        if (h.oldValue) teamIds.add(h.oldValue);
        if (h.newValue) teamIds.add(h.newValue);
      }
      if (h.field === 'location') {
        if (h.oldValue) locationIds.add(h.oldValue);
        if (h.newValue) locationIds.add(h.newValue);
      }
    }

    const [users, teams, locations, statuses] = await Promise.all([
      userIds.size
        ? this.prisma.user.findMany({
            where: { id: { in: [...userIds] } },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          })
        : Promise.resolve([]),
      teamIds.size
        ? this.prisma.team.findMany({
            where: { id: { in: [...teamIds] } },
            select: { id: true, name: true, code: true },
          })
        : Promise.resolve([]),
      locationIds.size
        ? this.prisma.location.findMany({
            where: { id: { in: [...locationIds] } },
            select: { id: true, name: true, site: true },
          })
        : Promise.resolve([]),
      this.prisma.ticketStatus.findMany({
        select: { code: true, name: true },
      }),
    ]);

    const userLabel = (id: string | null | undefined) => {
      if (!id) return 'Unassigned';
      const u = users.find((x) => x.id === id);
      if (!u) return 'Unknown user';
      const name = `${u.firstName} ${u.lastName}`.trim();
      return name || u.email;
    };
    const teamLabel = (id: string | null | undefined) => {
      if (!id) return 'No team';
      const t = teams.find((x) => x.id === id);
      return t?.name ?? 'Unknown team';
    };
    const locationLabel = (id: string | null | undefined) => {
      if (!id) return 'No location';
      const loc = locations.find((x) => x.id === id);
      if (!loc) return 'Unknown location';
      return loc.site ? `${loc.name} · ${loc.site}` : loc.name;
    };
    const statusLabel = (code: string | null | undefined) => {
      if (!code) return '—';
      return statuses.find((s) => s.code === code)?.name ?? code;
    };

    const personRef = (
      id: string | null | undefined,
    ): {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    } | null => {
      if (!id) return null;
      return users.find((u) => u.id === id) ?? null;
    };

    return history.map((h) => {
      const actor =
        h.actor ??
        (h.actorId ? personRef(h.actorId) : null) ??
        null;

      let oldLabel: string | null = h.oldValue;
      let newLabel: string | null = h.newValue;
      let summary = h.field;

      switch (h.field) {
        case 'created':
          summary = `Ticket created${h.newValue ? ` (${h.newValue})` : ''}`;
          oldLabel = null;
          newLabel = h.newValue;
          break;
        case 'assignee':
          oldLabel = userLabel(h.oldValue);
          newLabel = userLabel(h.newValue);
          summary = h.newValue
            ? `Assigned to ${newLabel}`
            : 'Cleared assignee';
          if (h.oldValue && h.newValue) {
            summary = `Reassigned to ${newLabel}`;
          }
          break;
        case 'team':
          oldLabel = h.oldValue ? teamLabel(h.oldValue) : null;
          newLabel = teamLabel(h.newValue);
          summary = h.oldValue
            ? `Team → ${newLabel}`
            : `Routed to team ${newLabel}`;
          break;
        case 'status':
          oldLabel = statusLabel(h.oldValue);
          newLabel = statusLabel(h.newValue);
          summary = `Status → ${newLabel}`;
          break;
        case 'priority':
          summary = `Priority → ${h.newValue ?? '—'}`;
          break;
        case 'location':
          oldLabel = h.oldValue ? locationLabel(h.oldValue) : null;
          newLabel = locationLabel(h.newValue);
          summary = `Origin site → ${newLabel}`;
          break;
        case 'major_incident':
          summary =
            h.newValue === 'true'
              ? 'Marked as major incident'
              : 'Cleared major incident flag';
          break;
        case 'root_cause':
          summary = h.newValue
            ? 'Updated root cause'
            : 'Cleared root cause';
          break;
        case 'workaround':
          summary = h.newValue
            ? 'Updated workaround'
            : 'Cleared workaround';
          break;
        case 'comment':
          summary = 'Public comment added';
          break;
        case 'internal_note':
          summary = 'Internal note added';
          break;
        case 'work_log':
          summary = 'Work log recorded';
          break;
        case 'parent':
          summary = h.newValue
            ? `Linked parent ${h.newValue}`
            : 'Parent unlinked';
          break;
        case 'child_linked':
          summary = `Linked child ${h.newValue ?? ''}`.trim();
          break;
        case 'child_unlinked':
          summary = `Unlinked child ${h.oldValue ?? ''}`.trim();
          break;
        case 'merged_into':
          summary = `Merged into ${h.newValue ?? 'another ticket'}`;
          break;
        case 'merged_from':
          summary = `Merged from ${h.newValue ?? 'source ticket(s)'}`;
          break;
        case 'merge':
          summary = 'Tickets merged';
          break;
        case 'promoted_from':
          summary = `Raised from ${h.newValue ?? 'related ticket'}`;
          break;
        case 'cab_requested':
          summary = 'Submitted to CAB for approval';
          break;
        case 'cab_required':
          summary =
            h.newValue === 'true'
              ? 'CAB review required'
              : 'CAB review not required';
          break;
        case 'change_risk':
          summary = h.newValue
            ? `Change risk → ${h.newValue}`
            : 'Cleared change risk';
          break;
        case 'change_plan':
          summary = 'Updated change plan';
          break;
        case 'rollback_plan':
          summary = 'Updated rollback plan';
          break;
        case 'scheduled_start':
          summary = h.newValue
            ? `Scheduled start → ${new Date(h.newValue).toLocaleString()}`
            : 'Cleared scheduled start';
          break;
        case 'scheduled_end':
          summary = h.newValue
            ? `Scheduled end → ${new Date(h.newValue).toLocaleString()}`
            : 'Cleared scheduled end';
          break;
        case 'approval':
          summary =
            h.newValue === 'approved'
              ? 'CAB / approval approved'
              : h.newValue === 'rejected'
                ? 'CAB / approval rejected'
                : `Approval → ${h.newValue ?? '—'}`;
          break;
        default:
          summary = h.field.replace(/_/g, ' ');
      }

      const actorName = actor
        ? `${actor.firstName} ${actor.lastName}`.trim() || actor.email
        : 'System';

      return {
        id: h.id,
        field: h.field,
        oldValue: h.oldValue,
        newValue: h.newValue,
        oldLabel,
        newLabel,
        summary,
        createdAt: h.createdAt,
        actor: actor
          ? {
              id: actor.id,
              firstName: actor.firstName,
              lastName: actor.lastName,
              email: actor.email,
            }
          : null,
        actorName,
      };
    });
  }

  private serialize(
    ticket: {
      comments?: Array<{ isInternal: boolean; [k: string]: unknown }>;
      status?: { isTerminal?: boolean; code?: string; [k: string]: unknown };
      dueAt?: Date | null;
      createdAt?: Date;
      history?: Array<{
        field: string;
        oldValue: string | null;
        newValue: string | null;
        createdAt: Date;
        [k: string]: unknown;
      }>;
      parent?: unknown;
      children?: unknown;
      mergedInto?: unknown;
      mergedFrom?: unknown;
      slaInstances?: Array<{
        metric: string;
        dueAt: Date;
        pausedAt: Date | null;
        completedAt: Date | null;
        breachedAt: Date | null;
        percentConsumed: number;
        [k: string]: unknown;
      }>;
      [k: string]: unknown;
    },
    user: AuthUserView,
  ) {
    const comments = Array.isArray(ticket.comments)
      ? ticket.comments.filter(
          (c) => !c.isInternal || this.canInternalNote(user),
        )
      : undefined;

    const timer = this.resolveSlaTimer(ticket);
    const stageDurations = Array.isArray(ticket.history)
      ? this.computeStageDurations(ticket)
      : undefined;

    // Newest-first for UI timeline (we store ascending for stage calc).
    const history = Array.isArray(ticket.history)
      ? [...ticket.history].reverse()
      : undefined;

    return {
      ...ticket,
      comments,
      history,
      stageDurations,
      dueAt: timer.dueAt,
      slaDueAt: timer.slaDueAt,
      slaRemainingMs: timer.slaRemainingMs,
      slaBreached: timer.slaBreached,
      slaPaused: timer.slaPaused,
      slaCompleted: timer.slaCompleted,
      slaPercentConsumed: timer.slaPercentConsumed,
      timeToResolution: timer.timeToResolution,
    };
  }
}
