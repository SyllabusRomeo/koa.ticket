import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(params: {
    userId: string;
    title: string;
    body: string;
    link?: string;
    eventType?: string;
  }) {
    if (params.eventType) {
      const pref = await this.prisma.notificationPreference.findUnique({
        where: {
          userId_eventType: {
            userId: params.userId,
            eventType: params.eventType,
          },
        },
      });
      if (pref && !pref.inAppEnabled) return null;
    }

    return this.prisma.notification.create({
      data: {
        userId: params.userId,
        title: params.title,
        body: params.body,
        link: params.link,
      },
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
