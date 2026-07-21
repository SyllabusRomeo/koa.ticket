import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  listRules() {
    return this.prisma.assignmentRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'asc' },
    });
  }

  async createRule(data: {
    name: string;
    categoryId?: string;
    ticketTypeId?: string;
    locationId?: string;
    teamId: string;
    priority?: number;
  }) {
    return this.prisma.assignmentRule.create({
      data: {
        name: data.name,
        categoryId: data.categoryId,
        ticketTypeId: data.ticketTypeId,
        locationId: data.locationId,
        teamId: data.teamId,
        priority: data.priority ?? 100,
      },
    });
  }

  async resolveTeamId(params: {
    categoryId?: string | null;
    typeId?: string | null;
    locationId?: string | null;
  }) {
    const rules = await this.prisma.assignmentRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'asc' },
    });

    for (const rule of rules) {
      if (rule.categoryId && rule.categoryId !== params.categoryId) continue;
      if (rule.ticketTypeId && rule.ticketTypeId !== params.typeId) continue;
      if (rule.locationId && rule.locationId !== params.locationId) continue;
      return rule.teamId;
    }
    return null;
  }
}
