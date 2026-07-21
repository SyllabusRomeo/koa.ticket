import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SlaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async createForTicket(ticketId: string, priorityId?: string | null) {
    const policy = await this.prisma.slaPolicy.findFirst({
      where: {
        isActive: true,
        OR: [{ priorityId: priorityId ?? undefined }, { priorityId: null }],
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!policy) return [];

    const now = new Date();
    const firstDue = new Date(
      now.getTime() + policy.firstResponseMinutes * 60_000,
    );
    const resolveDue = new Date(
      now.getTime() + policy.resolveMinutes * 60_000,
    );

    const [first, resolution] = await this.prisma.$transaction([
      this.prisma.slaInstance.create({
        data: {
          ticketId,
          policyId: policy.id,
          metric: 'first_response',
          startedAt: now,
          dueAt: firstDue,
        },
      }),
      this.prisma.slaInstance.create({
        data: {
          ticketId,
          policyId: policy.id,
          metric: 'resolution',
          startedAt: now,
          dueAt: resolveDue,
        },
      }),
    ]);

    // Denormalize resolution target onto the ticket for queue/list timers.
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { dueAt: resolveDue },
    });

    return [first, resolution];
  }

  listForTicket(ticketId: string) {
    return this.prisma.slaInstance.findMany({
      where: { ticketId },
      include: { policy: true },
    });
  }

  listPolicies() {
    return this.prisma.slaPolicy.findMany({
      where: { isActive: true },
      include: { escalations: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Worker tick: update consumption & escalate */
  async processDue() {
    const open = await this.prisma.slaInstance.findMany({
      where: { completedAt: null, breachedAt: null },
      include: {
        ticket: { include: { status: true, assignee: true, requester: true } },
        policy: { include: { escalations: true } },
      },
      take: 200,
    });

    const now = Date.now();
    for (const inst of open) {
      if (inst.ticket.status.pausesSla) {
        if (!inst.pausedAt) {
          await this.prisma.slaInstance.update({
            where: { id: inst.id },
            data: { pausedAt: new Date() },
          });
        }
        continue;
      }

      if (inst.pausedAt) {
        const pausedMs = now - inst.pausedAt.getTime();
        const newDue = new Date(inst.dueAt.getTime() + pausedMs);
        await this.prisma.slaInstance.update({
          where: { id: inst.id },
          data: {
            pausedAt: null,
            dueAt: newDue,
          },
        });
        if (inst.metric === 'resolution') {
          await this.prisma.ticket.update({
            where: { id: inst.ticketId },
            data: { dueAt: newDue },
          });
        }
        continue;
      }

      if (
        inst.metric === 'first_response' &&
        inst.ticket.firstResponseAt
      ) {
        await this.prisma.slaInstance.update({
          where: { id: inst.id },
          data: { completedAt: inst.ticket.firstResponseAt, percentConsumed: 100 },
        });
        continue;
      }
      if (inst.metric === 'resolution' && inst.ticket.resolvedAt) {
        await this.prisma.slaInstance.update({
          where: { id: inst.id },
          data: { completedAt: inst.ticket.resolvedAt, percentConsumed: 100 },
        });
        continue;
      }

      const total = inst.dueAt.getTime() - inst.startedAt.getTime();
      const used = now - inst.startedAt.getTime();
      const percent = Math.max(0, Math.min(200, (used / total) * 100));

      const data: {
        percentConsumed: number;
        breachedAt?: Date;
        lastEscalationPercent?: number;
      } = { percentConsumed: percent };

      if (percent >= 100 && !inst.breachedAt) {
        data.breachedAt = new Date();
      }

      const thresholds = inst.policy.escalations
        .map((e) => e.thresholdPercent)
        .sort((a, b) => a - b);
      const hit = thresholds.filter((t) => percent >= t).pop();
      if (hit != null && hit !== inst.lastEscalationPercent) {
        data.lastEscalationPercent = hit;
        const rule = inst.policy.escalations.find(
          (e) => e.thresholdPercent === hit,
        );
        if (rule) {
          await this.escalate(inst.ticket, hit, rule.notifyRoleCodes);
        }
      }

      await this.prisma.slaInstance.update({
        where: { id: inst.id },
        data,
      });
    }

    return { processed: open.length };
  }

  private async escalate(
    ticket: {
      id: string;
      number: string;
      title: string;
      assigneeId: string | null;
      requesterId: string;
    },
    percent: number,
    roleCodesCsv: string,
  ) {
    const roles = roleCodesCsv.split(',').map((s) => s.trim()).filter(Boolean);
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        roles: { some: { role: { code: { in: roles } } } },
      },
      select: { id: true },
      take: 50,
    });

    const targets = new Set(users.map((u) => u.id));
    if (ticket.assigneeId) targets.add(ticket.assigneeId);

    for (const userId of targets) {
      await this.notifications.notify({
        userId,
        eventType: 'sla.warning',
        title: `SLA ${percent}% — ${ticket.number}`,
        body: ticket.title,
        link: `/app/tickets`,
      });
    }
  }
}
