import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join, extname } from 'path';
import { randomBytes } from 'crypto';
import { PERMISSIONS } from '@logit/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUserView } from '../auth/auth.service';
import {
  extractKnowledgeAttachmentIds,
  sanitizeKnowledgeHtml,
} from './html-sanitize';

@Injectable()
export class KnowledgeService {
  private readonly uploadDir: string;
  private readonly maxBytes: number;
  private readonly allowed: Set<string>;
  private readonly imageExts = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.uploadDir = config.get('UPLOAD_DIR') ?? './data/uploads';
    this.maxBytes = Number(config.get('UPLOAD_MAX_BYTES') ?? 10_485_760);
    this.allowed = new Set(
      (
        config.get('ALLOWED_UPLOAD_EXTENSIONS') ??
        'pdf,png,jpg,jpeg,gif,doc,docx,xls,xlsx,txt,csv,zip'
      )
        .split(',')
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean),
    );
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  private serializeAttachment(row: {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    kind: string;
    createdAt: Date;
    uploadedById: string;
    articleId?: string | null;
    uploadedBy?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  }) {
    return {
      id: row.id,
      originalName: row.originalName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      kind: row.kind,
      createdAt: row.createdAt,
      uploadedById: row.uploadedById,
      articleId: row.articleId ?? null,
      url: `/api/v1/knowledge/attachments/${row.id}/content`,
      downloadUrl: `/api/v1/knowledge/attachments/${row.id}/download`,
      uploadedBy: row.uploadedBy
        ? {
            id: row.uploadedBy.id,
            firstName: row.uploadedBy.firstName,
            lastName: row.uploadedBy.lastName,
            email: row.uploadedBy.email,
          }
        : null,
    };
  }

  private attachmentInclude = {
    uploadedBy: {
      select: { id: true, firstName: true, lastName: true, email: true },
    },
  } as const;

  private async claimInlineFromBody(articleId: string, body: string) {
    const ids = extractKnowledgeAttachmentIds(body);
    if (!ids.length) return;
    await this.prisma.knowledgeAttachment.updateMany({
      where: {
        id: { in: ids },
        OR: [{ articleId: null }, { articleId }],
      },
      data: { articleId, kind: 'inline' },
    });
  }

  private async toArticleView(
    article: {
      id: string;
      slug: string;
      title: string;
      body: string;
      status: string;
      category: string | null;
      publishedAt: Date | null;
      createdById: string;
      createdAt: Date;
      updatedAt: Date;
    },
    includeAttachments = true,
  ) {
    const attachments = includeAttachments
      ? await this.prisma.knowledgeAttachment.findMany({
          where: { articleId: article.id, kind: 'attachment' },
          orderBy: { createdAt: 'desc' },
          include: this.attachmentInclude,
        })
      : [];
    return {
      ...article,
      body: article.body,
      attachments: attachments.map((a) => this.serializeAttachment(a)),
    };
  }

  listPublished() {
    return this.prisma.knowledgeArticle.findMany({
      where: { status: 'published' },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        publishedAt: true,
        status: true,
      },
    });
  }

  listAll() {
    return this.prisma.knowledgeArticle.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        publishedAt: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  async getBySlug(slug: string, allowDraft = false, viewerUserId?: string) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { slug },
    });
    if (!article) throw new NotFoundException('Article not found');
    if (!allowDraft && article.status !== 'published') {
      throw new NotFoundException('Article not found');
    }
    if (viewerUserId && article.status === 'published') {
      await this.recordEvent(article.id, 'view', viewerUserId).catch(() => undefined);
    }
    return this.toArticleView(article);
  }

  async recordEvent(
    articleId: string,
    eventType: 'view' | 'helpful' | 'not_helpful' | 'deflected',
    userId?: string,
  ) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id: articleId },
    });
    if (!article) throw new NotFoundException('Article not found');
    if (article.status !== 'published' && eventType !== 'view') {
      throw new BadRequestException('Article is not published');
    }
    return this.prisma.knowledgeEvent.create({
      data: {
        articleId,
        userId: userId ?? null,
        eventType,
      },
    });
  }

  async deflectionAnalytics(days = 30) {
    const rangeDays = Math.min(Math.max(days, 1), 365);
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - rangeDays);
    from.setUTCHours(0, 0, 0, 0);

    const events = await this.prisma.knowledgeEvent.findMany({
      where: { createdAt: { gte: from } },
      select: {
        articleId: true,
        eventType: true,
        createdAt: true,
        article: { select: { id: true, slug: true, title: true, category: true } },
      },
    });

    const totals = {
      views: 0,
      helpful: 0,
      notHelpful: 0,
      deflected: 0,
    };
    const byArticle = new Map<
      string,
      {
        id: string;
        slug: string;
        title: string;
        category: string | null;
        views: number;
        helpful: number;
        notHelpful: number;
        deflected: number;
      }
    >();
    const dailyMap = new Map<
      string,
      { date: string; views: number; deflected: number; helpful: number }
    >();

    for (const e of events) {
      if (e.eventType === 'view') totals.views += 1;
      else if (e.eventType === 'helpful') totals.helpful += 1;
      else if (e.eventType === 'not_helpful') totals.notHelpful += 1;
      else if (e.eventType === 'deflected') totals.deflected += 1;

      let row = byArticle.get(e.articleId);
      if (!row) {
        row = {
          id: e.article.id,
          slug: e.article.slug,
          title: e.article.title,
          category: e.article.category,
          views: 0,
          helpful: 0,
          notHelpful: 0,
          deflected: 0,
        };
        byArticle.set(e.articleId, row);
      }
      if (e.eventType === 'view') row.views += 1;
      else if (e.eventType === 'helpful') row.helpful += 1;
      else if (e.eventType === 'not_helpful') row.notHelpful += 1;
      else if (e.eventType === 'deflected') row.deflected += 1;

      const day = e.createdAt.toISOString().slice(0, 10);
      let dayRow = dailyMap.get(day);
      if (!dayRow) {
        dayRow = { date: day, views: 0, deflected: 0, helpful: 0 };
        dailyMap.set(day, dayRow);
      }
      if (e.eventType === 'view') dayRow.views += 1;
      if (e.eventType === 'deflected') dayRow.deflected += 1;
      if (e.eventType === 'helpful') dayRow.helpful += 1;
    }

    const feedback = totals.helpful + totals.notHelpful;
    const helpfulRate = feedback ? totals.helpful / feedback : null;
    const deflectionRate = totals.views
      ? totals.deflected / totals.views
      : null;

    const topArticles = [...byArticle.values()]
      .sort(
        (a, b) =>
          b.deflected + b.helpful + b.views -
          (a.deflected + a.helpful + a.views),
      )
      .slice(0, 15);

    return {
      from: from.toISOString(),
      to: new Date().toISOString(),
      rangeDays,
      totals,
      helpfulRate,
      deflectionRate,
      topArticles,
      daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  async create(data: {
    title: string;
    body: string;
    slug: string;
    category?: string;
    createdById: string;
    publish?: boolean;
  }) {
    const body = sanitizeKnowledgeHtml(data.body);
    const article = await this.prisma.knowledgeArticle.create({
      data: {
        title: data.title,
        body,
        slug: data.slug,
        category: data.category,
        createdById: data.createdById,
        status: data.publish ? 'published' : 'draft',
        publishedAt: data.publish ? new Date() : null,
      },
    });
    await this.claimInlineFromBody(article.id, body);
    return this.toArticleView(article);
  }

  async update(
    id: string,
    data: {
      title?: string;
      body?: string;
      category?: string | null;
      publish?: boolean;
    },
  ) {
    const existing = await this.prisma.knowledgeArticle.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Article not found');

    const publish = data.publish === true;
    const body =
      data.body === undefined ? undefined : sanitizeKnowledgeHtml(data.body);
    const article = await this.prisma.knowledgeArticle.update({
      where: { id },
      data: {
        title: data.title?.trim(),
        body,
        category: data.category === undefined ? undefined : data.category,
        ...(data.publish === undefined
          ? {}
          : {
              status: publish ? 'published' : 'draft',
              publishedAt: publish
                ? (existing.publishedAt ?? new Date())
                : null,
            }),
      },
    });
    if (body) await this.claimInlineFromBody(article.id, body);
    return this.toArticleView(article);
  }

  async publish(id: string) {
    const article = await this.prisma.knowledgeArticle.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date() },
    });
    return this.toArticleView(article);
  }

  private assertWrite(user: AuthUserView) {
    if (!user.permissions.includes(PERMISSIONS.KNOWLEDGE_WRITE)) {
      throw new ForbiddenException('knowledge:write required');
    }
  }

  private async assertCanReadArticle(
    user: AuthUserView,
    articleId: string | null | undefined,
  ) {
    if (!articleId) {
      // Orphan inline media: uploader or writers
      return;
    }
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id: articleId },
    });
    if (!article) throw new NotFoundException('Article not found');
    const canWrite = user.permissions.includes(PERMISSIONS.KNOWLEDGE_WRITE);
    if (article.status !== 'published' && !canWrite) {
      throw new NotFoundException('Attachment not found');
    }
    if (
      !canWrite &&
      !user.permissions.includes(PERMISSIONS.KNOWLEDGE_READ)
    ) {
      throw new ForbiddenException('Cannot read knowledge attachments');
    }
    return article;
  }

  private validateFile(file: Express.Multer.File, imagesOnly = false) {
    if (!file) throw new BadRequestException('File required');
    if (file.size > this.maxBytes) {
      throw new BadRequestException(
        `File too large (max ${Math.round(this.maxBytes / 1024 / 1024)} MB)`,
      );
    }
    const ext = extname(file.originalname).replace('.', '').toLowerCase();
    if (!this.allowed.has(ext)) {
      throw new BadRequestException(`Extension .${ext} not allowed`);
    }
    if (imagesOnly && !this.imageExts.has(ext)) {
      throw new BadRequestException('Only image files are allowed for inline media');
    }
    return ext;
  }

  async uploadMedia(user: AuthUserView, file: Express.Multer.File, articleId?: string) {
    this.assertWrite(user);
    const ext = this.validateFile(file, true);
    if (articleId) {
      const article = await this.prisma.knowledgeArticle.findUnique({
        where: { id: articleId },
      });
      if (!article) throw new NotFoundException('Article not found');
    }

    const storedName = `kb-${randomBytes(16).toString('hex')}.${ext}`;
    await writeFile(join(this.uploadDir, storedName), file.buffer);

    const row = await this.prisma.knowledgeAttachment.create({
      data: {
        articleId: articleId ?? null,
        uploadedById: user.id,
        originalName: file.originalname.slice(0, 255),
        storedName,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: file.size,
        kind: 'inline',
      },
      include: this.attachmentInclude,
    });
    return this.serializeAttachment(row);
  }

  async uploadAttachment(
    user: AuthUserView,
    articleId: string,
    file: Express.Multer.File,
  ) {
    this.assertWrite(user);
    const ext = this.validateFile(file, false);
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id: articleId },
    });
    if (!article) throw new NotFoundException('Article not found');

    const storedName = `kb-${randomBytes(16).toString('hex')}.${ext}`;
    await writeFile(join(this.uploadDir, storedName), file.buffer);

    const row = await this.prisma.knowledgeAttachment.create({
      data: {
        articleId,
        uploadedById: user.id,
        originalName: file.originalname.slice(0, 255),
        storedName,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: file.size,
        kind: 'attachment',
      },
      include: this.attachmentInclude,
    });
    return this.serializeAttachment(row);
  }

  async listAttachments(user: AuthUserView, articleId: string) {
    await this.assertCanReadArticle(user, articleId);
    const rows = await this.prisma.knowledgeAttachment.findMany({
      where: { articleId, kind: 'attachment' },
      orderBy: { createdAt: 'desc' },
      include: this.attachmentInclude,
    });
    return rows.map((r) => this.serializeAttachment(r));
  }

  async streamAttachment(
    user: AuthUserView,
    id: string,
    disposition: 'inline' | 'attachment',
  ) {
    const row = await this.prisma.knowledgeAttachment.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Attachment not found');

    if (row.articleId) {
      await this.assertCanReadArticle(user, row.articleId);
    } else {
      // Unclaimed media: only writer who uploaded, or any knowledge writer
      const canWrite = user.permissions.includes(PERMISSIONS.KNOWLEDGE_WRITE);
      if (!canWrite && row.uploadedById !== user.id) {
        throw new NotFoundException('Attachment not found');
      }
    }

    const path = join(this.uploadDir, row.storedName);
    if (!existsSync(path)) throw new NotFoundException('File missing');

    return {
      file: new StreamableFile(createReadStream(path)),
      filename: row.originalName,
      mimeType: row.mimeType,
      disposition,
    };
  }
}
