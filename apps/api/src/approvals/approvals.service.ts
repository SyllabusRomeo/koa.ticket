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

  listPolicies(includeInactive = false) {
    return this.prisma.approvalPolicy.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
      },
      orderBy: [{ isActive: 'desc' }, { priority: 'asc' }],
    });
  }

  assertCanManagePolicies(user: AuthUserView) {
    if (
      !user.permissions.includes(PERMISSIONS.APPROVALS_MANAGE) &&
      !user.permissions.includes(PERMISSIONS.SETTINGS_MANAGE)
    ) {
      throw new ForbiddenException(
        'approvals:manage or settings:manage required',
      );
    }
  }

  async createPolicy(data: {
    name: string;
    ticketTypeId?: string;
    categoryId?: string;
    changeRisk?: string;
    priority?: number;
    steps: Array<{
      name: string;
      approverRoleCode: string;
      mode?: 'any' | 'all';
      stepOrder?: number;
    }>;
  }) {
    if (!data.steps?.length) {
      throw new BadRequestException('At least one approval step is required');
    }
    return this.prisma.approvalPolicy.create({
      data: {
        name: data.name.trim(),
        ticketTypeId: data.ticketTypeId || null,
        categoryId: data.categoryId || null,
        changeRisk: data.changeRisk || null,
        priority: data.priority ?? 100,
        steps: {
          create: data.steps.map((s, i) => ({
            name: s.name.trim(),
            approverRoleCode: s.approverRoleCode.trim(),
            mode: s.mode === 'all' ? 'all' : 'any',
            stepOrder: s.stepOrder ?? i + 1,
          })),
        },
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
  }

  async updatePolicy(
    id: string,
    data: {
      name?: string;
      ticketTypeId?: string | null;
      categoryId?: string | null;
      changeRisk?: string | null;
      priority?: number;
      isActive?: boolean;
      steps?: Array<{
        name: string;
        approverRoleCode: string;
        mode?: 'any' | 'all';
        stepOrder?: number;
      }>;
    },
  ) {
    const existing = await this.prisma.approvalPolicy.findUnique({
      where: { id },
      include: { steps: true },
    });
    if (!existing) throw new NotFoundException('Policy not found');

    if (data.steps !== undefined) {
      if (!data.steps.length) {
        throw new BadRequestException('At least one approval step is required');
      }
      const pendingOnPolicy = await this.prisma.approval.count({
        where: { policyId: id, status: 'pending' },
      });
      if (pendingOnPolicy > 0) {
        throw new BadRequestException(
          'Cannot replace steps while this policy has pending approvals — deactivate instead or wait until they complete',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (data.steps) {
        await tx.approvalStep.deleteMany({ where: { policyId: id } });
        await tx.approvalStep.createMany({
          data: data.steps.map((s, i) => ({
            policyId: id,
            name: s.name.trim(),
            approverRoleCode: s.approverRoleCode.trim(),
            mode: s.mode === 'all' ? 'all' : 'any',
            stepOrder: s.stepOrder ?? i + 1,
          })),
        });
      }

      return tx.approvalPolicy.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(data.ticketTypeId !== undefined
            ? { ticketTypeId: data.ticketTypeId || null }
            : {}),
          ...(data.categoryId !== undefined
            ? { categoryId: data.categoryId || null }
            : {}),
          ...(data.changeRisk !== undefined
            ? { changeRisk: data.changeRisk || null }
            : {}),
          ...(data.priority !== undefined ? { priority: data.priority } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      });
    });
  }

  async createForTicket(ticketId: string, title: string, number: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId },
      select: {
        id: true,
        typeId: true,
        categoryId: true,
        changeRisk: true,
      },
    });
    if (!ticket) return;

    const policy = await this.resolvePolicy(ticket);
    if (!policy) {
      await this.createLegacyApprovals(ticketId, title, number);
      return;
    }

    const first = policy.steps[0];
    if (!first) {
      await this.createLegacyApprovals(ticketId, title, number);
      return;
    }

    await this.spawnStep({
      ticketId,
      title,
      number,
      policyId: policy.id,
      step: first,
    });
  }

  private async resolvePolicy(ticket: {
    typeId: string;
    categoryId: string | null;
    changeRisk: string | null;
  }) {
    const policies = await this.prisma.approvalPolicy.findMany({
      where: { isActive: true },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
      orderBy: { priority: 'asc' },
    });

    for (const p of policies) {
      if (p.ticketTypeId && p.ticketTypeId !== ticket.typeId) continue;
      if (p.categoryId && p.categoryId !== ticket.categoryId) continue;
      if (p.changeRisk && p.changeRisk !== ticket.changeRisk) continue;
      if (!p.steps.length) continue;
      return p;
    }
    return null;
  }

  private async createLegacyApprovals(
    ticketId: string,
    title: string,
    number: string,
  ) {
    const approvers = await this.usersWithRole(ROLES.APPROVER);
    for (const a of approvers) {
      await this.prisma.approval.create({
        data: { ticketId, approverId: a.id, status: 'pending', stepOrder: 1 },
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

  private async usersWithRole(roleCode: string) {
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        roles: { some: { role: { code: roleCode } } },
      },
      select: { id: true },
    });
  }

  private async spawnStep(params: {
    ticketId: string;
    title: string;
    number: string;
    policyId: string;
    step: {
      id: string;
      stepOrder: number;
      name: string;
      approverRoleCode: string;
    };
  }) {
    const approvers = await this.usersWithRole(params.step.approverRoleCode);
    if (!approvers.length) {
      // Soft-fail: leave no rows rather than blocking ticket create.
      return;
    }

    for (const a of approvers) {
      await this.prisma.approval.create({
        data: {
          ticketId: params.ticketId,
          approverId: a.id,
          policyId: params.policyId,
          stepId: params.step.id,
          stepOrder: params.step.stepOrder,
          status: 'pending',
        },
      });
      await this.notifications.notify({
        userId: a.id,
        eventType: 'approval.required',
        title: `Approval needed — ${params.number}`,
        body: `${params.title} · ${params.step.name}`,
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
        step: { select: { id: true, name: true, stepOrder: true, mode: true } },
        policy: { select: { id: true, name: true } },
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
      include: {
        ticket: { include: { status: true, type: true } },
        step: true,
        policy: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
      },
    });
    if (!approval) throw new NotFoundException('Approval not found');
    if (approval.approverId !== user.id) {
      throw new ForbiddenException('Not your approval');
    }
    if (approval.status !== 'pending') {
      throw new BadRequestException('Approval already decided');
    }

    await this.prisma.approval.update({
      where: { id },
      data: {
        status: decision,
        comment: comment?.trim() || null,
        decidedAt: new Date(),
      },
    });

    await this.audit.log({
      actorId: user.id,
      action: `approval.${decision}`,
      entityType: 'approval',
      entityId: id,
      after: { ticketId: approval.ticketId, comment },
    });

    if (decision === 'rejected') {
      await this.finalizeRejection(user, approval);
      return this.prisma.approval.findUnique({
        where: { id },
        include: {
          step: true,
          policy: true,
          ticket: { include: { status: true, type: true } },
        },
      });
    }

    // Approved path
    const stepComplete = await this.isStepComplete(approval);
    if (!stepComplete) {
      return this.prisma.approval.findUnique({
        where: { id },
        include: {
          step: true,
          policy: true,
          ticket: { include: { status: true, type: true } },
        },
      });
    }

    // Close remaining pending on this step (any-mode peers, or leftovers).
    await this.prisma.approval.updateMany({
      where: {
        ticketId: approval.ticketId,
        status: 'pending',
        stepOrder: approval.stepOrder ?? 1,
        id: { not: id },
      },
      data: {
        status: 'approved',
        comment: 'Auto-closed after step completion',
        decidedAt: new Date(),
      },
    });

    const nextStep = approval.policy?.steps.find(
      (s) => s.stepOrder > (approval.stepOrder ?? 1),
    );

    if (nextStep && approval.policyId) {
      await this.spawnStep({
        ticketId: approval.ticketId,
        title: approval.ticket.title,
        number: approval.ticket.number,
        policyId: approval.policyId,
        step: nextStep,
      });
      await this.notifications.notify({
        userId: approval.ticket.requesterId,
        eventType: 'approval.completed',
        title: `Step approved — ${approval.ticket.number}`,
        body: `${approval.ticket.title} · next: ${nextStep.name}`,
        link: `/app/tickets/${approval.ticket.number}`,
      });
    } else {
      await this.finalizeApproval(user, approval);
    }

    return this.prisma.approval.findUnique({
      where: { id },
      include: {
        step: true,
        policy: true,
        ticket: { include: { status: true, type: true } },
      },
    });
  }

  private async isStepComplete(approval: {
    id: string;
    ticketId: string;
    stepOrder: number | null;
    step: { mode: string } | null;
  }) {
    const mode = approval.step?.mode ?? 'any';
    if (mode === 'any') return true;

    const pending = await this.prisma.approval.count({
      where: {
        ticketId: approval.ticketId,
        stepOrder: approval.stepOrder ?? 1,
        status: 'pending',
        id: { not: approval.id },
      },
    });
    return pending === 0;
  }

  private async finalizeRejection(
    user: AuthUserView,
    approval: {
      ticketId: string;
      ticket: {
        id: string;
        number: string;
        title: string;
        requesterId: string;
        statusId: string;
        status: { code: string };
        type: { code: string };
      };
    },
  ) {
    await this.prisma.approval.updateMany({
      where: {
        ticketId: approval.ticketId,
        status: 'pending',
      },
      data: {
        status: 'rejected',
        comment: 'Auto-closed after rejection',
        decidedAt: new Date(),
      },
    });

    await this.applyTicketStatus(user, approval.ticket, 'cancelled');

    await this.notifications.notify({
      userId: approval.ticket.requesterId,
      eventType: 'approval.completed',
      title: `Request rejected`,
      body: approval.ticket.title,
      link: `/app/tickets/${approval.ticket.number}`,
    });
  }

  private async finalizeApproval(
    user: AuthUserView,
    approval: {
      ticketId: string;
      ticket: {
        id: string;
        number: string;
        title: string;
        requesterId: string;
        statusId: string;
        status: { code: string };
        type: { code: string };
      };
    },
  ) {
    const isChange = approval.ticket.type.code === 'change';
    const nextStatusCode = isChange ? 'scheduled' : 'open';
    await this.applyTicketStatus(user, approval.ticket, nextStatusCode);

    await this.notifications.notify({
      userId: approval.ticket.requesterId,
      eventType: 'approval.completed',
      title: isChange ? `CAB approved` : `Request approved`,
      body: approval.ticket.title,
      link: `/app/tickets/${approval.ticket.number}`,
    });
  }

  private async applyTicketStatus(
    user: AuthUserView,
    ticket: {
      id: string;
      number: string;
      statusId: string;
      status: { code: string };
    },
    nextStatusCode: string,
  ) {
    const nextStatus = await this.prisma.ticketStatus.findUnique({
      where: { code: nextStatusCode },
    });
    const fallback =
      nextStatusCode === 'cancelled'
        ? await this.prisma.ticketStatus.findUnique({
            where: { code: 'cancelled' },
          })
        : await this.prisma.ticketStatus.findUnique({ where: { code: 'open' } });
    const resolvedStatus = nextStatus ?? fallback;
    if (!resolvedStatus) {
      throw new BadRequestException(`Status ${nextStatusCode} is not configured`);
    }

    const allowed = await this.prisma.ticketStatusTransition.findUnique({
      where: {
        fromStatusId_toStatusId: {
          fromStatusId: ticket.statusId,
          toStatusId: resolvedStatus.id,
        },
      },
    });
    if (!allowed) {
      throw new BadRequestException(
        `Cannot move ticket to ${resolvedStatus.code} from ${ticket.status.code}`,
      );
    }

    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        statusId: resolvedStatus.id,
        version: { increment: 1 },
        history: {
          create: {
            actorId: user.id,
            field: 'approval',
            oldValue: 'pending',
            newValue: resolvedStatus.code,
          },
        },
      },
    });
  }
}
