import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SlaService } from './sla.service';

/**
 * Runs SLA processDue + resolved-ticket auto-close on an interval.
 * Default: every 60s. Override with SLA_POLL_SECONDS (15–600).
 * Set SLA_POLL_ENABLED=false to disable.
 * AUTO_CLOSE_RESOLVED_DAYS (default 3) controls resolved→closed.
 */
@Injectable()
export class SlaPoller implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlaPoller.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly sla: SlaService,
  ) {}

  onModuleInit() {
    if (!this.isEnabled()) {
      this.logger.log('SLA poller disabled (SLA_POLL_ENABLED=false)');
      return;
    }
    const seconds = this.pollIntervalSeconds();
    this.logger.log(`SLA / auto-close poller enabled — every ${seconds}s`);
    void this.tick().catch((err) =>
      this.logger.warn(
        `Initial SLA tick failed: ${err instanceof Error ? err.message : err}`,
      ),
    );
    this.timer = setInterval(() => {
      void this.tick().catch((err) =>
        this.logger.warn(
          `SLA tick failed: ${err instanceof Error ? err.message : err}`,
        ),
      );
    }, seconds * 1000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isEnabled(): boolean {
    const raw = this.config.get<string>('SLA_POLL_ENABLED')?.trim().toLowerCase();
    if (raw === 'false' || raw === '0' || raw === 'off') return false;
    return true;
  }

  pollIntervalSeconds(): number {
    const raw = Number(this.config.get('SLA_POLL_SECONDS') ?? '60');
    if (!Number.isFinite(raw) || raw < 15) return 60;
    return Math.min(raw, 600);
  }

  autoCloseDays(): number {
    const raw = Number(this.config.get('AUTO_CLOSE_RESOLVED_DAYS') ?? '3');
    if (!Number.isFinite(raw) || raw < 1) return 3;
    return Math.min(raw, 90);
  }

  async tick() {
    if (this.running) return { skipped: true as const, reason: 'already_running' };
    this.running = true;
    try {
      const sla = await this.sla.processDue();
      const closed = await this.autoCloseResolved();
      return { sla, closed };
    } finally {
      this.running = false;
    }
  }

  /** Close tickets resolved longer than N days with no requester comment since resolve. */
  async autoCloseResolved() {
    const days = this.autoCloseDays();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const closedStatus = await this.prisma.ticketStatus.findUnique({
      where: { code: 'closed' },
    });
    const resolvedStatus = await this.prisma.ticketStatus.findUnique({
      where: { code: 'resolved' },
    });
    if (!closedStatus || !resolvedStatus) {
      return { closed: 0, days };
    }

    const candidates = await this.prisma.ticket.findMany({
      where: {
        deletedAt: null,
        statusId: resolvedStatus.id,
        resolvedAt: { lte: cutoff, not: null },
      },
      select: {
        id: true,
        number: true,
        version: true,
        requesterId: true,
        resolvedAt: true,
      },
      take: 50,
    });

    let closed = 0;
    for (const ticket of candidates) {
      if (!ticket.resolvedAt) continue;
      const requesterComment = await this.prisma.ticketComment.findFirst({
        where: {
          ticketId: ticket.id,
          authorId: ticket.requesterId,
          isInternal: false,
          createdAt: { gt: ticket.resolvedAt },
        },
        select: { id: true },
      });
      if (requesterComment) continue;

      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          statusId: closedStatus.id,
          closedAt: new Date(),
          version: { increment: 1 },
          history: {
            create: {
              field: 'status',
              oldValue: 'resolved',
              newValue: 'closed',
            },
          },
        },
      });
      closed += 1;
    }

    if (closed > 0) {
      this.logger.log(`Auto-closed ${closed} resolved ticket(s) (days=${days})`);
    }
    return { closed, days };
  }
}
