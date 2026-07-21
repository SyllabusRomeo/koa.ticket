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
import { AuditService } from '../audit/audit.service';
import type { AuthUserView } from '../auth/auth.service';

@Injectable()
export class AttachmentsService {
  private readonly uploadDir: string;
  private readonly maxBytes: number;
  private readonly allowed: Set<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.uploadDir = config.get('UPLOAD_DIR') ?? './data/uploads';
    this.maxBytes = Number(config.get('UPLOAD_MAX_BYTES') ?? 10_485_760);
    this.allowed = new Set(
      (config.get('ALLOWED_UPLOAD_EXTENSIONS') ?? 'pdf,png,jpg,jpeg,txt')
        .split(',')
        .map((s: string) => s.trim().toLowerCase()),
    );
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  private async assertTicketAccess(user: AuthUserView, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, deletedAt: null },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const canQueue =
      user.permissions.includes(PERMISSIONS.TICKETS_READ_ALL) ||
      user.permissions.includes(PERMISSIONS.TICKETS_READ_QUEUE);
    if (ticket.requesterId !== user.id && !canQueue) {
      throw new ForbiddenException('Ticket not found');
    }
    return ticket;
  }

  async upload(
    user: AuthUserView,
    ticketId: string,
    file: Express.Multer.File,
    ip?: string,
  ) {
    await this.assertTicketAccess(user, ticketId);
    if (!file) throw new BadRequestException('File required');
    if (file.size > this.maxBytes) {
      throw new BadRequestException('File too large');
    }
    const ext = extname(file.originalname).replace('.', '').toLowerCase();
    if (!this.allowed.has(ext)) {
      throw new BadRequestException(`Extension .${ext} not allowed`);
    }

    const storedName = `${randomBytes(16).toString('hex')}.${ext}`;
    await writeFile(join(this.uploadDir, storedName), file.buffer);

    const attachment = await this.prisma.ticketAttachment.create({
      data: {
        ticketId,
        uploadedById: user.id,
        originalName: file.originalname.slice(0, 255),
        storedName,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: file.size,
      },
    });

    await this.audit.log({
      actorId: user.id,
      action: 'attachment.upload',
      entityType: 'ticket_attachment',
      entityId: attachment.id,
      after: { ticketId, originalName: attachment.originalName },
      ipAddress: ip,
    });

    return attachment;
  }

  async list(user: AuthUserView, ticketId: string) {
    await this.assertTicketAccess(user, ticketId);
    return this.prisma.ticketAttachment.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        uploadedById: true,
      },
    });
  }

  async download(user: AuthUserView, id: string) {
    const attachment = await this.prisma.ticketAttachment.findUnique({
      where: { id },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    await this.assertTicketAccess(user, attachment.ticketId);

    const path = join(this.uploadDir, attachment.storedName);
    if (!existsSync(path)) throw new NotFoundException('File missing');

    return {
      file: new StreamableFile(createReadStream(path)),
      filename: attachment.originalName,
      mimeType: attachment.mimeType,
    };
  }
}
