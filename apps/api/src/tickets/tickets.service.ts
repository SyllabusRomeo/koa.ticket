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
        history: {
          create: {
            actorId: user.id,
            field: 'created',
            newValue: number,
          },
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
          link: '/app/tickets',
        });
      }
    }

    return this.serialize(ticket, user);
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

  async get(user: AuthUserView, idOrNumber: string) {
    const ticket = await this.findAccessible(user, idOrNumber, true);
    return this.serialize(ticket, user);
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

      data.status = { connect: { id: next.id } };
      history.push({
        actorId: user.id,
        field: 'status',
        oldValue: existing.status.code,
        newValue: next.code,
      });

      if (next.code === 'resolved') data.resolvedAt = new Date();
      if (next.code === 'closed') data.closedAt = new Date();
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

    return this.serialize(ticket, user);
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

    return comment;
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
        ? { orderBy: { createdAt: 'desc' as const }, take: 50 }
        : false,
    };
  }

  private serialize(
    ticket: {
      comments?: Array<{ isInternal: boolean; [k: string]: unknown }>;
      [k: string]: unknown;
    },
    user: AuthUserView,
  ) {
    const comments = Array.isArray(ticket.comments)
      ? ticket.comments.filter(
          (c) => !c.isInternal || this.canInternalNote(user),
        )
      : undefined;

    return { ...ticket, comments };
  }
}
