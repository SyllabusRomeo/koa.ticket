import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PERMISSIONS, ROLES } from '@logit/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUserView } from '../auth/auth.service';

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async createForTicket(ticketId: string, title: string, number: string) {
    const approvers = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        roles: { some: { role: { code: ROLES.APPROVER } } },
      },
      select: { id: true },
    });

    for (const a of approvers) {
      await this.prisma.approval.create({
        data: {
          ticketId,
          approverId: a.id,
          status: 'pending',
        },
      });
      await this.notifications.notify({
        userId: a.id,
        eventType: 'approval.required',
        title: `Approval needed — ${number}`,
        body: title,
        link: '/app/approvals',
      });
    }
  }

  async listMine(user: AuthUserView, status?: string) {
    if (!user.permissions.includes(PERMISSIONS.APPROVALS_READ)) {
      throw new ForbiddenException('Cannot view approvals');
    }
    return this.prisma.approval.findMany({
      where: {
        approverId: user.id,
        ...(status ? { status } : {}),
      },
      include: {
        ticket: {
          include: {
            status: true,
            type: true,
            requester: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async decide(
    user: AuthUserView,
    id: string,
    decision: 'approved' | 'rejected',
    comment?: string,
  ) {
    if (!user.permissions.includes(PERMISSIONS.APPROVALS_DECIDE)) {
      throw new ForbiddenException('Cannot decide approvals');
    }

    const approval = await this.prisma.approval.findUnique({
      where: { id },
      include: { ticket: { include: { status: true } } },
    });
    if (!approval) throw new NotFoundException('Approval not found');
    if (approval.approverId !== user.id) {
      throw new ForbiddenException('Not your approval');
    }
    if (approval.status !== 'pending') {
      throw new BadRequestException('Approval already decided');
    }

    const nextStatusCode = decision === 'approved' ? 'open' : 'cancelled';
    const nextStatus = await this.prisma.ticketStatus.findUniqueOrThrow({
      where: { code: nextStatusCode },
    });

    const allowed = await this.prisma.ticketStatusTransition.findUnique({
      where: {
        fromStatusId_toStatusId: {
          fromStatusId: approval.ticket.statusId,
          toStatusId: nextStatus.id,
        },
      },
    });
    if (!allowed) {
      throw new BadRequestException(
        `Cannot move ticket to ${nextStatusCode} from ${approval.ticket.status.code}`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.approval.update({
        where: { id },
        data: {
          status: decision,
          comment: comment?.trim() || null,
          decidedAt: new Date(),
        },
      }),
      this.prisma.ticket.update({
        where: { id: approval.ticketId },
        data: {
          statusId: nextStatus.id,
          version: { increment: 1 },
          history: {
            create: {
              actorId: user.id,
              field: 'approval',
              oldValue: 'pending',
              newValue: decision,
            },
          },
        },
      }),
      // Close sibling pending approvals for same ticket
      this.prisma.approval.updateMany({
        where: {
          ticketId: approval.ticketId,
          status: 'pending',
          id: { not: id },
        },
        data: {
          status: decision === 'approved' ? 'approved' : 'rejected',
          comment: 'Auto-closed after peer decision',
          decidedAt: new Date(),
        },
      }),
    ]);

    await this.audit.log({
      actorId: user.id,
      action: `approval.${decision}`,
      entityType: 'approval',
      entityId: id,
      after: { ticketId: approval.ticketId, comment },
    });

    await this.notifications.notify({
      userId: approval.ticket.requesterId,
      eventType: 'approval.completed',
      title: `Request ${decision}`,
      body: approval.ticket.title,
      link: '/app/tickets',
    });

    return this.prisma.approval.findUnique({
      where: { id },
      include: {
        ticket: { include: { status: true, type: true } },
      },
    });
  }
}
