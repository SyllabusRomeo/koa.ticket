import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ASSET_STATUS_ALIASES,
  ASSET_STATUSES,
  type AssetStatusCode,
} from '@logit/shared';
import { PrismaService } from '../prisma/prisma.service';

const PERSON_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} as const;

const ASSET_INCLUDE = {
  type: true,
  assignedUser: { select: PERSON_SELECT },
  location: {
    select: { id: true, code: true, name: true, site: true, country: true },
  },
  tickets: {
    select: {
      ticketId: true,
      ticket: {
        select: {
          id: true,
          number: true,
          title: true,
          status: { select: { code: true, name: true } },
        },
      },
    },
    take: 20,
  },
} as const;

export type ListAssetsQuery = {
  status?: string;
  typeCode?: string;
  typeId?: string;
  locationId?: string;
  q?: string;
  take?: number;
};

export type CreateAssetInput = {
  assetTag: string;
  typeCode: string;
  name?: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  assignedUserId?: string | null;
  locationId?: string | null;
  status?: string;
  purchaseDate?: string | null;
  warrantyExpiresAt?: string | null;
  notes?: string | null;
};

export type UpdateAssetInput = {
  assetTag?: string;
  typeCode?: string;
  name?: string | null;
  serialNumber?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  assignedUserId?: string | null;
  locationId?: string | null;
  status?: string;
  purchaseDate?: string | null;
  warrantyExpiresAt?: string | null;
  notes?: string | null;
};

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeStatus(raw?: string | null): AssetStatusCode {
    if (!raw?.trim()) return 'in_stock';
    const key = raw.trim().toLowerCase().replace(/\s+/g, '_');
    const mapped = ASSET_STATUS_ALIASES[key];
    if (!mapped) {
      throw new BadRequestException(
        `Invalid status. Allowed: ${ASSET_STATUSES.join(', ')}`,
      );
    }
    return mapped;
  }

  /** Read-path coercion — never throws on legacy/unknown values. */
  private coerceStatus(raw: string): string {
    const key = raw.trim().toLowerCase().replace(/\s+/g, '_');
    return ASSET_STATUS_ALIASES[key] ?? key;
  }

  statuses() {
    return ASSET_STATUSES.map((code) => ({
      code,
      name: this.statusLabel(code),
    }));
  }

  statusLabel(code: string): string {
    const labels: Record<string, string> = {
      in_stock: 'In stock',
      in_service: 'In service',
      in_repair: 'In repair',
      retired: 'Retired',
      disposed: 'Disposed',
      in_use: 'In service',
      under_repair: 'In repair',
    };
    return labels[code] ?? code.replace(/_/g, ' ');
  }

  types() {
    return this.prisma.assetType.findMany({ orderBy: { name: 'asc' } });
  }

  async assignees() {
    return this.prisma.user.findMany({
      where: { deletedAt: null, isActive: true },
      select: PERSON_SELECT,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 500,
    });
  }

  private parseOptionalDate(value?: string | null): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    return d;
  }

  private displayName(asset: {
    name?: string | null;
    manufacturer?: string | null;
    model?: string | null;
    assetTag: string;
  }): string {
    if (asset.name?.trim()) return asset.name.trim();
    const parts = [asset.manufacturer, asset.model]
      .map((p) => p?.trim())
      .filter(Boolean);
    return parts.length ? parts.join(' ') : asset.assetTag;
  }

  private serialize<T extends {
    name?: string | null;
    manufacturer?: string | null;
    model?: string | null;
    assetTag: string;
    status: string;
  }>(asset: T) {
    const status = this.coerceStatus(asset.status);
    return {
      ...asset,
      status,
      statusName: this.statusLabel(status),
      displayName: this.displayName(asset),
    };
  }

  async list(query: ListAssetsQuery = {}) {
    const where: Prisma.AssetWhereInput = { deletedAt: null };

    if (query.status) {
      where.status = this.normalizeStatus(query.status);
    }
    if (query.typeId) {
      where.typeId = query.typeId;
    } else if (query.typeCode) {
      where.type = { code: query.typeCode.toUpperCase() };
    }
    if (query.locationId) {
      where.locationId = query.locationId;
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { assetTag: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { serialNumber: { contains: q, mode: 'insensitive' } },
        { manufacturer: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
        {
          assignedUser: {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
        { location: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const take = Math.min(Math.max(query.take ?? 200, 1), 500);
    const rows = await this.prisma.asset.findMany({
      where,
      include: {
        type: true,
        assignedUser: { select: PERSON_SELECT },
        location: {
          select: {
            id: true,
            code: true,
            name: true,
            site: true,
            country: true,
          },
        },
      },
      orderBy: { assetTag: 'asc' },
      take,
    });
    return rows.map((r) => this.serialize(r));
  }

  async get(id: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, deletedAt: null },
      include: ASSET_INCLUDE,
    });
    if (!asset) throw new NotFoundException('Asset not found');
    return this.serialize(asset);
  }

  async create(dto: CreateAssetInput) {
    const type = await this.prisma.assetType.findUnique({
      where: { code: dto.typeCode.toUpperCase() },
    });
    if (!type) throw new BadRequestException('Invalid asset type');

    if (dto.assignedUserId) {
      const user = await this.prisma.user.findFirst({
        where: { id: dto.assignedUserId, deletedAt: null },
      });
      if (!user) throw new BadRequestException('Assigned user not found');
    }
    if (dto.locationId) {
      const loc = await this.prisma.location.findFirst({
        where: { id: dto.locationId, deletedAt: null },
      });
      if (!loc) throw new BadRequestException('Location not found');
    }

    const status = this.normalizeStatus(dto.status);
    const created = await this.prisma.asset.create({
      data: {
        assetTag: dto.assetTag.trim().toUpperCase(),
        name: dto.name?.trim() || null,
        typeId: type.id,
        serialNumber: dto.serialNumber?.trim() || null,
        manufacturer: dto.manufacturer?.trim() || null,
        model: dto.model?.trim() || null,
        assignedUserId: dto.assignedUserId || null,
        locationId: dto.locationId || null,
        status,
        purchaseDate: this.parseOptionalDate(dto.purchaseDate) ?? null,
        warrantyExpiresAt:
          this.parseOptionalDate(dto.warrantyExpiresAt) ?? null,
        notes: dto.notes?.trim() || null,
      },
      include: {
        type: true,
        assignedUser: { select: PERSON_SELECT },
        location: {
          select: {
            id: true,
            code: true,
            name: true,
            site: true,
            country: true,
          },
        },
      },
    });
    return this.serialize(created);
  }

  async update(id: string, dto: UpdateAssetInput) {
    const existing = await this.prisma.asset.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Asset not found');

    const data: Prisma.AssetUpdateInput = {};

    if (dto.assetTag !== undefined) {
      data.assetTag = dto.assetTag.trim().toUpperCase();
    }
    if (dto.name !== undefined) {
      data.name = dto.name?.trim() || null;
    }
    if (dto.typeCode !== undefined) {
      const type = await this.prisma.assetType.findUnique({
        where: { code: dto.typeCode.toUpperCase() },
      });
      if (!type) throw new BadRequestException('Invalid asset type');
      data.type = { connect: { id: type.id } };
    }
    if (dto.serialNumber !== undefined) {
      data.serialNumber = dto.serialNumber?.trim() || null;
    }
    if (dto.manufacturer !== undefined) {
      data.manufacturer = dto.manufacturer?.trim() || null;
    }
    if (dto.model !== undefined) {
      data.model = dto.model?.trim() || null;
    }
    if (dto.status !== undefined) {
      data.status = this.normalizeStatus(dto.status);
    }
    if (dto.notes !== undefined) {
      data.notes = dto.notes?.trim() || null;
    }
    if (dto.purchaseDate !== undefined) {
      data.purchaseDate = this.parseOptionalDate(dto.purchaseDate) ?? null;
    }
    if (dto.warrantyExpiresAt !== undefined) {
      data.warrantyExpiresAt =
        this.parseOptionalDate(dto.warrantyExpiresAt) ?? null;
    }
    if (dto.assignedUserId !== undefined) {
      if (dto.assignedUserId === null || dto.assignedUserId === '') {
        data.assignedUser = { disconnect: true };
      } else {
        const user = await this.prisma.user.findFirst({
          where: { id: dto.assignedUserId, deletedAt: null },
        });
        if (!user) throw new BadRequestException('Assigned user not found');
        data.assignedUser = { connect: { id: user.id } };
      }
    }
    if (dto.locationId !== undefined) {
      if (dto.locationId === null || dto.locationId === '') {
        data.location = { disconnect: true };
      } else {
        const loc = await this.prisma.location.findFirst({
          where: { id: dto.locationId, deletedAt: null },
        });
        if (!loc) throw new BadRequestException('Location not found');
        data.location = { connect: { id: loc.id } };
      }
    }

    const updated = await this.prisma.asset.update({
      where: { id },
      data,
      include: {
        type: true,
        assignedUser: { select: PERSON_SELECT },
        location: {
          select: {
            id: true,
            code: true,
            name: true,
            site: true,
            country: true,
          },
        },
      },
    });
    return this.serialize(updated);
  }

  /** Soft-retire: mark retired and hide from active register. */
  async softDelete(id: string) {
    const existing = await this.prisma.asset.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Asset not found');

    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        status: 'retired',
        deletedAt: new Date(),
        assignedUserId: null,
      },
      include: {
        type: true,
        assignedUser: { select: PERSON_SELECT },
        location: {
          select: {
            id: true,
            code: true,
            name: true,
            site: true,
            country: true,
          },
        },
      },
    });
    return this.serialize(updated);
  }

  async linkToTicket(ticketId: string, assetId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, deletedAt: null },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    return this.prisma.ticketAsset.upsert({
      where: { ticketId_assetId: { ticketId, assetId } },
      create: { ticketId, assetId },
      update: {},
    });
  }

  async exportCsv(query: ListAssetsQuery = {}) {
    const rows = await this.list({ ...query, take: 5000 });
    const escape = (value: string | number | null | undefined) => {
      const s = value == null ? '' : String(value);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const person = (
      p?: {
        email: string;
        firstName: string;
        lastName: string;
      } | null,
    ) => {
      if (!p) return '';
      const name = `${p.firstName} ${p.lastName}`.trim();
      return name ? `${name} <${p.email}>` : p.email;
    };

    const header = [
      'assetTag',
      'name',
      'type',
      'status',
      'serialNumber',
      'manufacturer',
      'model',
      'assignee',
      'location',
      'purchaseDate',
      'warrantyExpiresAt',
      'notes',
    ].join(',');

    const lines = rows.map((a) =>
      [
        escape(a.assetTag),
        escape(a.displayName),
        escape(a.type?.name ?? ''),
        escape(a.status),
        escape(a.serialNumber),
        escape(a.manufacturer),
        escape(a.model),
        escape(person(a.assignedUser)),
        escape(a.location?.name ?? ''),
        escape(
          a.purchaseDate
            ? new Date(a.purchaseDate).toISOString().slice(0, 10)
            : '',
        ),
        escape(
          a.warrantyExpiresAt
            ? new Date(a.warrantyExpiresAt).toISOString().slice(0, 10)
            : '',
        ),
        escape(a.notes),
      ].join(','),
    );

    return `${header}\n${lines.join('\n')}`;
  }
}
