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

  limits() {
    return {
      maxBytes: this.maxBytes,
      allowedExtensions: [...this.allowed].sort(),
      storage: 'local',
      uploadDirHint: 'UPLOAD_DIR (ephemeral on Render unless a disk is attached)',
    };
  }

  private canReadTicket(user: AuthUserView, requesterId: string) {
    return (
      requesterId === user.id ||
      user.permissions.includes(PERMISSIONS.TICKETS_READ_ALL) ||
      user.permissions.includes(PERMISSIONS.TICKETS_READ_QUEUE)
    );
  }

  private canUpload(user: AuthUserView, requesterId: string) {
    if (requesterId === user.id) return true;
    return user.permissions.includes(PERMISSIONS.TICKETS_WRITE);
  }

  private async findTicket(user: AuthUserView, idOrNumber: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id: idOrNumber }, { number: idOrNumber }],
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (!this.canReadTicket(user, ticket.requesterId)) {
      throw new ForbiddenException('Ticket not found');
    }
    return ticket;
  }

  async upload(
    user: AuthUserView,
    idOrNumber: string,
    file: Express.Multer.File,
    ip?: string,
  ) {
    const ticket = await this.findTicket(user, idOrNumber);
    if (!this.canUpload(user, ticket.requesterId)) {
      throw new ForbiddenException('Cannot attach files to this ticket');
    }
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

    const storedName = `${randomBytes(16).toString('hex')}.${ext}`;
    await writeFile(join(this.uploadDir, storedName), file.buffer);

    const attachment = await this.prisma.ticketAttachment.create({
      data: {
        ticketId: ticket.id,
        uploadedById: user.id,
        originalName: file.originalname.slice(0, 255),
        storedName,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: file.size,
      },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    await this.audit.log({
      actorId: user.id,
      action: 'attachment.upload',
      entityType: 'ticket_attachment',
      entityId: attachment.id,
      after: {
        ticketId: ticket.id,
        ticketNumber: ticket.number,
        originalName: attachment.originalName,
      },
      ipAddress: ip,
    });

    return this.serialize(attachment);
  }

  async list(user: AuthUserView, idOrNumber: string) {
    const ticket = await this.findTicket(user, idOrNumber);
    const rows = await this.prisma.ticketAttachment.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    return rows.map((r) => this.serialize(r));
  }

  async download(user: AuthUserView, id: string) {
    const attachment = await this.prisma.ticketAttachment.findUnique({
      where: { id },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    await this.findTicket(user, attachment.ticketId);

    const path = join(this.uploadDir, attachment.storedName);
    if (!existsSync(path)) throw new NotFoundException('File missing');

    return {
      file: new StreamableFile(createReadStream(path)),
      filename: attachment.originalName,
      mimeType: attachment.mimeType,
    };
  }

  private serialize(row: {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
    uploadedById: string;
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
      createdAt: row.createdAt,
      uploadedById: row.uploadedById,
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
}
