import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const TYPE_HINTS: Array<{ code: string; words: string[] }> = [
  {
    code: 'incident',
    words: [
      'outage',
      'down',
      'broken',
      'error',
      'failed',
      'crash',
      'offline',
      'cannot',
      'unable',
      'issue',
    ],
  },
  {
    code: 'service_request',
    words: [
      'request',
      'need',
      'please',
      'provision',
      'new',
      'laptop',
      'accessories',
      'install',
    ],
  },
  {
    code: 'access_request',
    words: [
      'access',
      'permission',
      'vpn',
      'login',
      'account',
      'unlock',
      'password',
      'role',
    ],
  },
  {
    code: 'security_incident',
    words: [
      'phish',
      'malware',
      'ransomware',
      'breach',
      'suspicious',
      'compromised',
      'security',
    ],
  },
  {
    code: 'problem',
    words: ['recurring', 'root cause', 'pattern', 'widespread', 'known error'],
  },
  {
    code: 'change',
    words: ['change', 'deploy', 'release', 'upgrade', 'migration', 'cab'],
  },
];

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  provider(): { mode: 'heuristic' | 'openai'; model?: string } {
    const key = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (key) {
      return {
        mode: 'openai',
        model: this.config.get('OPENAI_MODEL')?.trim() || 'gpt-4o-mini',
      };
    }
    return { mode: 'heuristic' };
  }

  private async openaiChat(
    system: string,
    user: string,
  ): Promise<string | null> {
    const key = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!key) return null;
    const model = this.config.get('OPENAI_MODEL')?.trim() || 'gpt-4o-mini';
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content?.trim() || null;
    } catch {
      return null;
    }
  }

  async classify(input: { title: string; description: string }) {
    const title = input.title?.trim() ?? '';
    const description = input.description?.trim() ?? '';
    if (title.length < 3 && description.length < 3) {
      throw new BadRequestException('Provide a title or description');
    }
    const text = `${title}\n${description}`;
    const tokens = tokenize(text);

    const [types, categories, priorities] = await Promise.all([
      this.prisma.ticketType.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.category.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.priority.findMany({ orderBy: { rank: 'asc' } }),
    ]);

    const typeScores = types.map((t) => {
      const hints =
        TYPE_HINTS.find((h) => h.code === t.code.toLowerCase())?.words ?? [];
      const nameTokens = tokenize(`${t.code} ${t.name}`);
      let score = jaccard(tokens, nameTokens);
      for (const w of hints) {
        if (text.toLowerCase().includes(w)) score += 0.12;
      }
      return { code: t.code, name: t.name, score };
    });
    typeScores.sort((a, b) => b.score - a.score);

    const categoryScores = categories.map((c) => {
      const nameTokens = tokenize(`${c.code} ${c.name}`);
      let score = jaccard(tokens, nameTokens) * 1.4;
      for (const w of tokenize(c.name)) {
        if (tokens.has(w)) score += 0.08;
      }
      return { code: c.code, name: c.name, score };
    });
    categoryScores.sort((a, b) => b.score - a.score);

    let impact: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    let urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    const lower = text.toLowerCase();
    if (
      /\b(all users|entire|company.?wide|production down|outage|critical)\b/.test(
        lower,
      )
    ) {
      impact = 'critical';
      urgency = 'critical';
    } else if (/\b(many|department|team|urgent|asap|blocked)\b/.test(lower)) {
      impact = 'high';
      urgency = 'high';
    } else if (/\b(minor|low|when convenient|sometime)\b/.test(lower)) {
      impact = 'low';
      urgency = 'low';
    }

    let priorityCode =
      priorities.find((p) => p.code.includes('p3'))?.code ??
      priorities[Math.floor(priorities.length / 2)]?.code ??
      null;
    if (impact === 'critical' || urgency === 'critical') {
      priorityCode =
        priorities.find((p) => p.code.includes('p1'))?.code ?? priorityCode;
    } else if (impact === 'high' || urgency === 'high') {
      priorityCode =
        priorities.find((p) => p.code.includes('p2'))?.code ?? priorityCode;
    } else if (impact === 'low' && urgency === 'low') {
      priorityCode =
        priorities.find((p) => p.code.includes('p4') || p.code.includes('p5'))
          ?.code ?? priorityCode;
    }

    const provider = this.provider();
    let rationale =
      'Heuristic keyword match against ticket types and categories.';
    if (provider.mode === 'openai') {
      const llm = await this.openaiChat(
        'You classify IT support tickets. Reply with one short sentence explaining the best type and category.',
        `Title: ${title}\nDescription: ${description}\nTop type: ${typeScores[0]?.name}\nTop category: ${categoryScores[0]?.name}`,
      );
      if (llm) rationale = llm;
    }

    return {
      provider: provider.mode,
      typeCode: typeScores[0]?.code ?? 'incident',
      typeName: typeScores[0]?.name ?? 'Incident',
      categoryCode: categoryScores[0]?.code ?? null,
      categoryName: categoryScores[0]?.name ?? null,
      impact,
      urgency,
      priorityCode,
      confidence: Math.min(
        0.95,
        Math.max(typeScores[0]?.score ?? 0, categoryScores[0]?.score ?? 0, 0.2),
      ),
      rationale,
      alternatives: {
        types: typeScores.slice(0, 3).map(({ code, name, score }) => ({
          code,
          name,
          score: Number(score.toFixed(3)),
        })),
        categories: categoryScores.slice(0, 3).map(({ code, name, score }) => ({
          code,
          name,
          score: Number(score.toFixed(3)),
        })),
      },
    };
  }

  async summarize(input: {
    title?: string;
    description?: string;
    ticketId?: string;
    ticketNumber?: string;
  }) {
    let title = input.title?.trim() ?? '';
    let description = input.description?.trim() ?? '';
    let comments: string[] = [];
    let number: string | undefined;

    if (input.ticketId || input.ticketNumber) {
      const ticket = await this.prisma.ticket.findFirst({
        where: input.ticketId
          ? { id: input.ticketId, deletedAt: null }
          : { number: input.ticketNumber, deletedAt: null },
        include: {
          comments: {
            where: { isInternal: false },
            orderBy: { createdAt: 'desc' },
            take: 8,
            select: { body: true },
          },
        },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');
      title = ticket.title;
      description = ticket.description;
      number = ticket.number;
      comments = ticket.comments.map((c) => c.body);
    }

    if (!title && !description) {
      throw new BadRequestException('Nothing to summarize');
    }

    const provider = this.provider();
    if (provider.mode === 'openai') {
      const llm = await this.openaiChat(
        'Summarize this IT support ticket in 2-3 sentences for an agent. Mention current state if comments exist. No markdown.',
        `Ticket ${number ?? ''}\nTitle: ${title}\nDescription: ${description}\nRecent comments:\n${comments.join('\n---\n')}`,
      );
      if (llm) {
        return { provider: 'openai' as const, summary: llm, ticketNumber: number };
      }
    }

    const sentences = `${description}`
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const head = sentences.slice(0, 2).join(' ');
    const summary = [
      title ? `${title}.` : '',
      head || description.slice(0, 280),
      comments.length
        ? `There ${comments.length === 1 ? 'is' : 'are'} ${comments.length} recent public comment${comments.length === 1 ? '' : 's'}.`
        : '',
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      provider: 'heuristic' as const,
      summary,
      ticketNumber: number,
    };
  }

  async findDuplicates(input: {
    title: string;
    description?: string;
    excludeTicketId?: string;
    take?: number;
  }) {
    const title = input.title?.trim() ?? '';
    if (title.length < 3) {
      throw new BadRequestException('Title required');
    }
    const queryTokens = tokenize(`${title}\n${input.description ?? ''}`);
    const take = Math.min(Math.max(input.take ?? 5, 1), 15);

    const closed = await this.prisma.ticketStatus.findMany({
      where: { code: { in: ['closed', 'cancelled', 'merged'] } },
      select: { id: true },
    });
    const closedIds = closed.map((s) => s.id);

    const candidates = await this.prisma.ticket.findMany({
      where: {
        deletedAt: null,
        mergedIntoId: null,
        ...(closedIds.length ? { statusId: { notIn: closedIds } } : {}),
        ...(input.excludeTicketId ? { id: { not: input.excludeTicketId } } : {}),
      },
      select: {
        id: true,
        number: true,
        title: true,
        description: true,
        status: { select: { code: true, name: true } },
        priority: { select: { code: true, name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
    });

    const scored = candidates
      .map((t) => {
        const score = jaccard(
          queryTokens,
          tokenize(`${t.title}\n${t.description}`),
        );
        return { ...t, score };
      })
      .filter((t) => t.score >= 0.18)
      .sort((a, b) => b.score - a.score)
      .slice(0, take);

    return {
      provider: this.provider().mode,
      matches: scored.map((t) => ({
        id: t.id,
        number: t.number,
        title: t.title,
        status: t.status,
        priority: t.priority,
        createdAt: t.createdAt,
        score: Number(t.score.toFixed(3)),
      })),
    };
  }

  async slaRisk(ticketRef: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        OR: [{ id: ticketRef }, { number: ticketRef }],
        deletedAt: null,
      },
      include: {
        status: true,
        priority: true,
        slaInstances: {
          orderBy: { createdAt: 'desc' },
          take: 4,
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const now = Date.now();
    const terminal = new Set(['closed', 'cancelled', 'merged', 'resolved']);
    const factors: string[] = [];
    let score = 0;

    if (terminal.has(ticket.status.code)) {
      return {
        provider: this.provider().mode,
        ticketNumber: ticket.number,
        level: 'none' as const,
        score: 0,
        factors: [`Ticket is ${ticket.status.name}`],
        dueAt: ticket.dueAt,
        priority: ticket.priority,
        status: ticket.status,
      };
    }

    const due = ticket.dueAt ? ticket.dueAt.getTime() : null;
    if (due != null) {
      const hoursLeft = (due - now) / 3_600_000;
      if (hoursLeft < 0) {
        score += 70;
        factors.push(`Past due by ${Math.abs(Math.round(hoursLeft))}h`);
      } else if (hoursLeft <= 1) {
        score += 55;
        factors.push('Due within 1 hour');
      } else if (hoursLeft <= 4) {
        score += 40;
        factors.push('Due within 4 hours');
      } else if (hoursLeft <= 24) {
        score += 25;
        factors.push('Due within 24 hours');
      }
    } else {
      factors.push('No resolution due date set');
    }

    for (const sla of ticket.slaInstances) {
      if (sla.breachedAt) {
        score += 25;
        factors.push(`SLA ${sla.metric} breached`);
      } else if (sla.dueAt && !sla.completedAt) {
        const h = (sla.dueAt.getTime() - now) / 3_600_000;
        if (h >= 0 && h <= 2) {
          score += 15;
          factors.push(`SLA ${sla.metric} target within 2h`);
        }
      }
    }

    const rank = ticket.priority?.rank ?? 3;
    if (rank <= 1) {
      score += 20;
      factors.push('P1 / critical priority');
    } else if (rank === 2) {
      score += 12;
      factors.push('High priority');
    }

    if (!ticket.assigneeId) {
      score += 15;
      factors.push('Unassigned');
    }

    const ageHours = (now - ticket.createdAt.getTime()) / 3_600_000;
    if (ageHours > 72 && !ticket.firstResponseAt) {
      score += 10;
      factors.push('No first response after 72h');
    }

    score = Math.min(100, score);
    const level =
      score >= 70 ? 'critical' : score >= 45 ? 'high' : score >= 25 ? 'medium' : 'low';

    let narrative = `SLA risk is ${level} (score ${score}).`;
    const provider = this.provider();
    if (provider.mode === 'openai') {
      const llm = await this.openaiChat(
        'You are an ITSM ops assistant. In one sentence, explain SLA risk to an agent.',
        `${ticket.number} ${ticket.title}. Factors: ${factors.join('; ')}. Score ${score} (${level}).`,
      );
      if (llm) narrative = llm;
    }

    return {
      provider: provider.mode,
      ticketNumber: ticket.number,
      level,
      score,
      factors,
      narrative,
      dueAt: ticket.dueAt,
      priority: ticket.priority
        ? { code: ticket.priority.code, name: ticket.priority.name }
        : null,
      status: { code: ticket.status.code, name: ticket.status.name },
    };
  }

  /** Suggest published KB articles related to free text (light assist). */
  async suggestKnowledge(input: { title: string; description?: string }) {
    const queryTokens = tokenize(
      `${input.title}\n${input.description ?? ''}`,
    );
    const articles = await this.prisma.knowledgeArticle.findMany({
      where: { status: 'published' },
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        body: true,
      },
      take: 100,
      orderBy: { publishedAt: 'desc' },
    });
    const matches = articles
      .map((a) => {
        const score = jaccard(
          queryTokens,
          tokenize(`${a.title}\n${a.category ?? ''}\n${stripHtml(a.body).slice(0, 800)}`),
        );
        return {
          id: a.id,
          slug: a.slug,
          title: a.title,
          category: a.category,
          score: Number(score.toFixed(3)),
        };
      })
      .filter((a) => a.score >= 0.12)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return { provider: this.provider().mode, matches };
  }
}
