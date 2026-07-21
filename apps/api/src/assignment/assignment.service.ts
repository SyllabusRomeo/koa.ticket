import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async listRules() {
    const rules = await this.prisma.assignmentRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'asc' },
    });

    const categoryIds = [
      ...new Set(rules.map((r) => r.categoryId).filter(Boolean)),
    ] as string[];
    const typeIds = [
      ...new Set(rules.map((r) => r.ticketTypeId).filter(Boolean)),
    ] as string[];
    const locationIds = [
      ...new Set(rules.map((r) => r.locationId).filter(Boolean)),
    ] as string[];
    const teamIds = [...new Set(rules.map((r) => r.teamId))];

    const [categories, types, locations, teams] = await Promise.all([
      categoryIds.length
        ? this.prisma.category.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, code: true, name: true },
          })
        : [],
      typeIds.length
        ? this.prisma.ticketType.findMany({
            where: { id: { in: typeIds } },
            select: { id: true, code: true, name: true },
          })
        : [],
      locationIds.length
        ? this.prisma.location.findMany({
            where: { id: { in: locationIds } },
            select: { id: true, code: true, name: true },
          })
        : [],
      teamIds.length
        ? this.prisma.team.findMany({
            where: { id: { in: teamIds } },
            select: { id: true, code: true, name: true },
          })
        : [],
    ]);

    const catMap = new Map(categories.map((c) => [c.id, c]));
    const typeMap = new Map(types.map((t) => [t.id, t]));
    const locMap = new Map(locations.map((l) => [l.id, l]));
    const teamMap = new Map(teams.map((t) => [t.id, t]));

    return rules.map((r) => ({
      ...r,
      category: r.categoryId ? (catMap.get(r.categoryId) ?? null) : null,
      ticketType: r.ticketTypeId ? (typeMap.get(r.ticketTypeId) ?? null) : null,
      location: r.locationId ? (locMap.get(r.locationId) ?? null) : null,
      team: teamMap.get(r.teamId) ?? null,
    }));
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
