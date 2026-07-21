import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PERMISSIONS } from '@logit/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUserView } from '../auth/auth.service';
import { AssignmentService } from '../assignment/assignment.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SlaService } from '../sla/sla.service';
import {
  AddCommentDto,
  CreateTicketDto,
  UpdateTicketDto,
} from './dto/ticket.dto';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignment: AssignmentService,
    private readonly approvals: ApprovalsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly sla: SlaService,
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

  private canReadAll(user: AuthUserView) {
    return (
      user.permissions.includes(PERMISSIONS.TICKETS_READ_ALL) ||
      user.permissions.includes(PERMISSIONS.TICKETS_READ_QUEUE)
    );
  }

  private canInternalNote(user: AuthUserView) {
    return user.permissions.includes(PERMISSIONS.TICKETS_INTERNAL_NOTE);
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
      type.code === 'service_request' || type.code === 'access_request';
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

    const teamId = await this.assignment.resolveTeamId({
      categoryId,
      typeId: type.id,
      locationId: user.locationId,
    });

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
        departmentId: user.departmentId,
        locationId: user.locationId,
        teamId: teamId ?? undefined,
        parentId,
        history: {
          create: [
            {
              actorId: user.id,
              field: 'created',
              newValue: number,
            },
            ...(parentId
              ? [
                  {
                    actorId: user.id,
                    field: 'parent',
                    newValue: dto.parentNumber!.trim(),
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

    const notified = new Set<string>();
    if (teamId) {
      const members = await this.prisma.teamMember.findMany({
        where: { teamId },
        select: { userId: true },
        take: 20,
      });
      for (const m of members) {
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
        title: `Ticket created ${number}`,
        body: ticket.title,
        link: `/app/tickets/${ticket.number}`,
        email: { ticketNumber: number, eventLabel: 'Ticket created' },
      });
    }

    const withSla = await this.prisma.ticket.findFirstOrThrow({
      where: { id: ticket.id },
      include: this.defaultInclude(false),
    });
    return this.serialize(withSla, user);
  }

  async list(user: AuthUserView) {
    const where: Prisma.TicketWhereInput = { deletedAt: null };
    if (!this.canReadAll(user)) {
      where.requesterId = user.id;
    }

    const tickets = await this.prisma.ticket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: this.defaultInclude(false),
    });

    return tickets.map((t) => this.serialize(t, user));
  }

  /** CSV of the same ticket visibility as list (scoped for employees). */
  async exportCsv(user: AuthUserView, ipAddress?: string | null) {
    const where: Prisma.TicketWhereInput = { deletedAt: null };
    if (!this.canReadAll(user)) {
      where.requesterId = user.id;
    }

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
    return {
      ...this.serialize(ticket, user),
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
      data.assignee = dto.assigneeId
        ? { connect: { id: dto.assigneeId } }
        : { disconnect: true };
      history.push({
        actorId: user.id,
        field: 'assignee',
        oldValue: existing.assigneeId,
        newValue: dto.assigneeId,
      });
    }

    if (dto.teamId !== undefined) {
      if (!user.permissions.includes(PERMISSIONS.TICKETS_ASSIGN)) {
        throw new ForbiddenException('Cannot assign tickets');
      }
      data.team = dto.teamId
        ? { connect: { id: dto.teamId } }
        : { disconnect: true };
      history.push({
        actorId: user.id,
        field: 'team',
        oldValue: existing.teamId,
        newValue: dto.teamId,
      });
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
      const statusRecipients = new Set<string>([ticket.requesterId]);
      if (ticket.assigneeId) statusRecipients.add(ticket.assigneeId);
      statusRecipients.delete(user.id);
      for (const userId of statusRecipients) {
        await this.notifications.notify({
          userId,
          eventType: 'ticket.status',
          title: `${ticket.number} status → ${dto.statusCode}`,
          body: `${ticket.title} (${existing.status.code} → ${dto.statusCode})`,
          link: `/app/tickets/${ticket.number}`,
          email: {
            ticketNumber: ticket.number,
            eventLabel: `Status: ${dto.statusCode}`,
          },
        });
      }
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
    }

    return comment;
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

  async meta() {
    const [types, statuses, categories, priorities, matrix] = await Promise.all(
      [
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
      ],
    );

    return { types, statuses, categories, priorities, matrix };
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

    const allowed =
      ticket.requesterId === user.id || this.canReadAll(user);
    if (!allowed) throw new ForbiddenException('Ticket not found');

    return ticket;
  }

  private defaultInclude(withComments: boolean) {
    return {
      type: true,
      status: true,
      priority: true,
      category: true,
      subcategory: true,
      requester: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      assignee: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      team: { select: { id: true, code: true, name: true } },
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
        ? { orderBy: { createdAt: 'asc' as const }, take: 200 }
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
