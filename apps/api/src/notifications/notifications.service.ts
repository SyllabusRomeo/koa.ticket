import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async notify(params: {
    userId: string;
    title: string;
    body: string;
    link?: string;
    eventType?: string;
    /** Optional structured email fields (falls back to title/body/link). */
    email?: {
      ticketNumber?: string;
      eventLabel?: string;
    };
  }) {
    let pref: { inAppEnabled: boolean; emailEnabled: boolean } | null = null;
    if (params.eventType) {
      pref = await this.prisma.notificationPreference.findUnique({
        where: {
          userId_eventType: {
            userId: params.userId,
            eventType: params.eventType,
          },
        },
      });
    }

    let notification = null;
    if (!pref || pref.inAppEnabled) {
      notification = await this.prisma.notification.create({
        data: {
          userId: params.userId,
          title: params.title,
          body: params.body,
          link: params.link,
        },
      });
    }

    if (!pref || pref.emailEnabled) {
      await this.deliverEmail(params);
    }

    return notification;
  }

  private async deliverEmail(params: {
    userId: string;
    title: string;
    body: string;
    link?: string;
    email?: { ticketNumber?: string; eventLabel?: string };
  }) {
    const user = await this.prisma.user.findFirst({
      where: { id: params.userId, deletedAt: null, isActive: true },
      select: { email: true },
    });
    if (!user?.email) return;

    const ticketNumber = params.email?.ticketNumber;
    if (ticketNumber) {
      await this.email.sendTicketEvent({
        to: user.email,
        ticketNumber,
        title: params.body,
        eventLabel: params.email?.eventLabel ?? params.title,
        body: params.body,
        linkPath: params.link,
      });
      return;
    }

    const base = this.email.publicAppUrl();
    const url = params.link
      ? params.link.startsWith('http')
        ? params.link
        : `${base}${params.link}`
      : base;
    await this.email.send({
      to: user.email,
      subject: params.title,
      text: `${params.body}\n\n${url}\n\n— LogIT`,
      html: `<p>${escapeHtml(params.body).replace(/\n/g, '<br/>')}</p>
<p><a href="${escapeHtml(url)}">Open in LogIT</a></p>
<p>— LogIT</p>`,
    });
  }

  listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async getPreferences(userId: string) {
    return this.prisma.notificationPreference.findMany({ where: { userId } });
  }

  async upsertPreference(
    userId: string,
    eventType: string,
    data: { emailEnabled?: boolean; inAppEnabled?: boolean },
  ) {
    return this.prisma.notificationPreference.upsert({
      where: { userId_eventType: { userId, eventType } },
      create: {
        userId,
        eventType,
        emailEnabled: data.emailEnabled ?? true,
        inAppEnabled: data.inAppEnabled ?? true,
      },
      update: data,
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
