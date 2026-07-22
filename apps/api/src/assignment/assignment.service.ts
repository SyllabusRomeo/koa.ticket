import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type RoutingMatch = {
  teamId: string | null;
  assigneeId: string | null;
  ruleId: string | null;
};

@Injectable()
export class AssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async listSkills() {
    return this.prisma.skill.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { users: true } },
      },
    });
  }

  async createSkill(data: {
    code: string;
    name: string;
    description?: string;
  }) {
    const code = data.code.trim().toUpperCase().replace(/\s+/g, '_');
    if (!code) throw new BadRequestException('Skill code is required');
    const existing = await this.prisma.skill.findUnique({ where: { code } });
    if (existing) throw new BadRequestException('Skill code already exists');
    return this.prisma.skill.create({
      data: {
        code,
        name: data.name.trim(),
        description: data.description?.trim() || null,
      },
    });
  }

  async setUserSkills(userId: string, skillIds: string[]) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const unique = [...new Set(skillIds.filter(Boolean))];
    if (unique.length) {
      const skills = await this.prisma.skill.findMany({
        where: { id: { in: unique }, isActive: true },
        select: { id: true },
      });
      if (skills.length !== unique.length) {
        throw new BadRequestException('One or more skills were not found');
      }
    }

    await this.prisma.$transaction([
      this.prisma.userSkill.deleteMany({ where: { userId } }),
      ...(unique.length
        ? [
            this.prisma.userSkill.createMany({
              data: unique.map((skillId) => ({ userId, skillId })),
            }),
          ]
        : []),
    ]);

    return this.getUserSkills(userId);
  }

  async getUserSkills(userId: string) {
    const rows = await this.prisma.userSkill.findMany({
      where: { userId },
      include: {
        skill: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: { skill: { name: 'asc' } },
    });
    return rows.map((r) => r.skill);
  }

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
    const skillIds = [
      ...new Set(rules.map((r) => r.skillId).filter(Boolean)),
    ] as string[];

    const [categories, types, locations, teams, skills] = await Promise.all([
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
      skillIds.length
        ? this.prisma.skill.findMany({
            where: { id: { in: skillIds } },
            select: { id: true, code: true, name: true },
          })
        : [],
    ]);

    const catMap = new Map(categories.map((c) => [c.id, c]));
    const typeMap = new Map(types.map((t) => [t.id, t]));
    const locMap = new Map(locations.map((l) => [l.id, l]));
    const teamMap = new Map(teams.map((t) => [t.id, t]));
    const skillMap = new Map(skills.map((s) => [s.id, s]));

    return rules.map((r) => ({
      ...r,
      category: r.categoryId ? (catMap.get(r.categoryId) ?? null) : null,
      ticketType: r.ticketTypeId ? (typeMap.get(r.ticketTypeId) ?? null) : null,
      location: r.locationId ? (locMap.get(r.locationId) ?? null) : null,
      team: teamMap.get(r.teamId) ?? null,
      skill: r.skillId ? (skillMap.get(r.skillId) ?? null) : null,
    }));
  }

  async createRule(data: {
    name: string;
    categoryId?: string;
    ticketTypeId?: string;
    locationId?: string;
    teamId: string;
    skillId?: string;
    autoAssignAssignee?: boolean;
    priority?: number;
  }) {
    const team = await this.prisma.team.findFirst({
      where: { id: data.teamId, deletedAt: null, isActive: true },
    });
    if (!team) throw new BadRequestException('Team not found');

    if (data.skillId) {
      const skill = await this.prisma.skill.findFirst({
        where: { id: data.skillId, isActive: true },
      });
      if (!skill) throw new BadRequestException('Skill not found');
    }

    return this.prisma.assignmentRule.create({
      data: {
        name: data.name,
        categoryId: data.categoryId || null,
        ticketTypeId: data.ticketTypeId || null,
        locationId: data.locationId || null,
        teamId: data.teamId,
        skillId: data.skillId || null,
        autoAssignAssignee: !!data.autoAssignAssignee,
        priority: data.priority ?? 100,
      },
    });
  }

  /** @deprecated Prefer resolveRouting — kept for callers that only need team. */
  async resolveTeamId(params: {
    categoryId?: string | null;
    typeId?: string | null;
    locationId?: string | null;
  }) {
    const match = await this.resolveRouting(params);
    return match.teamId;
  }

  async resolveRouting(params: {
    categoryId?: string | null;
    typeId?: string | null;
    locationId?: string | null;
  }): Promise<RoutingMatch> {
    const rules = await this.prisma.assignmentRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'asc' },
    });

    for (const rule of rules) {
      if (rule.categoryId && rule.categoryId !== params.categoryId) continue;
      if (rule.ticketTypeId && rule.ticketTypeId !== params.typeId) continue;
      if (rule.locationId && rule.locationId !== params.locationId) continue;

      let assigneeId: string | null = null;
      if (rule.autoAssignAssignee) {
        assigneeId = await this.pickLeastLoadedAssignee(
          rule.teamId,
          rule.skillId,
        );
      }

      return {
        teamId: rule.teamId,
        assigneeId,
        ruleId: rule.id,
      };
    }

    return { teamId: null, assigneeId: null, ruleId: null };
  }

  /**
   * Among active team members (optionally requiring a skill), pick the agent
   * with the fewest open (non-terminal) tickets. Ties: lead first, then user id.
   */
  async pickLeastLoadedAssignee(
    teamId: string,
    skillId?: string | null,
  ): Promise<string | null> {
    const members = await this.prisma.teamMember.findMany({
      where: {
        teamId,
        user: {
          deletedAt: null,
          isActive: true,
          ...(skillId ? { skills: { some: { skillId } } } : {}),
        },
      },
      select: {
        userId: true,
        isLead: true,
      },
    });

    // When a skill is required and nobody has it, leave unassigned (team still set).
    if (!members.length) return null;

    const userIds = members.map((c) => c.userId);
    const openCounts = await this.prisma.ticket.groupBy({
      by: ['assigneeId'],
      where: {
        deletedAt: null,
        assigneeId: { in: userIds },
        status: { isTerminal: false },
      },
      _count: { _all: true },
    });
    const countMap = new Map(
      openCounts.map((row) => [row.assigneeId!, row._count._all]),
    );

    const ranked = [...members].sort((a, b) => {
      const ca = countMap.get(a.userId) ?? 0;
      const cb = countMap.get(b.userId) ?? 0;
      if (ca !== cb) return ca - cb;
      if (a.isLead !== b.isLead) return a.isLead ? -1 : 1;
      return a.userId.localeCompare(b.userId);
    });

    return ranked[0]?.userId ?? null;
  }
}
