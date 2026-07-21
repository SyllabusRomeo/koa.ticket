import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

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
      },
    });
  }

  listAll() {
    return this.prisma.knowledgeArticle.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getBySlug(slug: string, allowDraft = false) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { slug },
    });
    if (!article) throw new NotFoundException('Article not found');
    if (!allowDraft && article.status !== 'published') {
      throw new NotFoundException('Article not found');
    }
    return article;
  }

  create(data: {
    title: string;
    body: string;
    slug: string;
    category?: string;
    createdById: string;
    publish?: boolean;
  }) {
    return this.prisma.knowledgeArticle.create({
      data: {
        title: data.title,
        body: data.body,
        slug: data.slug,
        category: data.category,
        createdById: data.createdById,
        status: data.publish ? 'published' : 'draft',
        publishedAt: data.publish ? new Date() : null,
      },
    });
  }

  async publish(id: string) {
    return this.prisma.knowledgeArticle.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date() },
    });
  }
}
