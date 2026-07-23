import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ASSET_RELATION_TYPES,
  ASSET_RELATION_TYPE_LABELS,
  ASSET_STATUS_ALIASES,
  ASSET_STATUSES,
  type AssetRelationType,
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

  relationTypes() {
    return ASSET_RELATION_TYPES.map((code) => ({
      code,
      name: ASSET_RELATION_TYPE_LABELS[code],
    }));
  }

  normalizeRelationType(raw: string): AssetRelationType {
    const key = raw.trim().toLowerCase().replace(/\s+/g, '_');
    if (!(ASSET_RELATION_TYPES as readonly string[]).includes(key)) {
      throw new BadRequestException(
        `Invalid relation type. Allowed: ${ASSET_RELATION_TYPES.join(', ')}`,
      );
    }
    return key as AssetRelationType;
  }

  private relationAssetSelect = {
    id: true,
    assetTag: true,
    name: true,
    status: true,
    type: { select: { code: true, name: true } },
  } as const;

  async listRelations(assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, deletedAt: null },
      select: { id: true },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    const rows = await this.prisma.assetRelation.findMany({
      where: {
        OR: [{ fromAssetId: assetId }, { toAssetId: assetId }],
      },
      include: {
        fromAsset: { select: this.relationAssetSelect },
        toAsset: { select: this.relationAssetSelect },
      },
      orderBy: [{ relationType: 'asc' }, { createdAt: 'asc' }],
    });

    return rows.map((r) => ({
      id: r.id,
      relationType: r.relationType,
      relationTypeName:
        ASSET_RELATION_TYPE_LABELS[r.relationType as AssetRelationType] ??
        r.relationType,
      notes: r.notes,
      direction: r.fromAssetId === assetId ? 'outgoing' : 'incoming',
      fromAsset: this.serialize(r.fromAsset as never),
      toAsset: this.serialize(r.toAsset as never),
      otherAsset: this.serialize(
        (r.fromAssetId === assetId ? r.toAsset : r.fromAsset) as never,
      ),
      createdAt: r.createdAt,
    }));
  }

  async createRelation(
    fromAssetId: string,
    input: { toAssetId: string; relationType: string; notes?: string },
  ) {
    if (fromAssetId === input.toAssetId) {
      throw new BadRequestException('Cannot relate an asset to itself');
    }
    const [from, to] = await Promise.all([
      this.prisma.asset.findFirst({
        where: { id: fromAssetId, deletedAt: null },
      }),
      this.prisma.asset.findFirst({
        where: { id: input.toAssetId, deletedAt: null },
      }),
    ]);
    if (!from) throw new NotFoundException('Source asset not found');
    if (!to) throw new NotFoundException('Target asset not found');

    const relationType = this.normalizeRelationType(input.relationType);
    try {
      const created = await this.prisma.assetRelation.create({
        data: {
          fromAssetId,
          toAssetId: input.toAssetId,
          relationType,
          notes: input.notes?.trim() || null,
        },
        include: {
          fromAsset: { select: this.relationAssetSelect },
          toAsset: { select: this.relationAssetSelect },
        },
      });
      return {
        id: created.id,
        relationType: created.relationType,
        relationTypeName: ASSET_RELATION_TYPE_LABELS[relationType],
        notes: created.notes,
        fromAsset: this.serialize(created.fromAsset as never),
        toAsset: this.serialize(created.toAsset as never),
      };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException('This relationship already exists');
      }
      throw e;
    }
  }

  async deleteRelation(assetId: string, relationId: string) {
    const rel = await this.prisma.assetRelation.findFirst({
      where: {
        id: relationId,
        OR: [{ fromAssetId: assetId }, { toAssetId: assetId }],
      },
    });
    if (!rel) throw new NotFoundException('Relationship not found');
    await this.prisma.assetRelation.delete({ where: { id: relationId } });
    return { ok: true };
  }

  /** BFS neighborhood for change/incident impact preview. */
  async impact(assetId: string, depth = 2) {
    const root = await this.prisma.asset.findFirst({
      where: { id: assetId, deletedAt: null },
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
    if (!root) throw new NotFoundException('Asset not found');

    const maxDepth = Math.min(Math.max(depth, 1), 4);
    const visited = new Map<string, number>();
    visited.set(assetId, 0);
    const edges: Array<{
      fromAssetId: string;
      toAssetId: string;
      relationType: string;
      relationTypeName: string;
    }> = [];
    let frontier = [assetId];

    for (let d = 0; d < maxDepth && frontier.length; d++) {
      const rels = await this.prisma.assetRelation.findMany({
        where: {
          OR: [
            { fromAssetId: { in: frontier } },
            { toAssetId: { in: frontier } },
          ],
        },
      });
      const next: string[] = [];
      for (const r of rels) {
        edges.push({
          fromAssetId: r.fromAssetId,
          toAssetId: r.toAssetId,
          relationType: r.relationType,
          relationTypeName:
            ASSET_RELATION_TYPE_LABELS[r.relationType as AssetRelationType] ??
            r.relationType,
        });
        for (const id of [r.fromAssetId, r.toAssetId]) {
          if (!visited.has(id)) {
            visited.set(id, d + 1);
            next.push(id);
          }
        }
      }
      frontier = next;
    }

    const neighborIds = [...visited.keys()].filter((id) => id !== assetId);
    const neighbors = neighborIds.length
      ? await this.prisma.asset.findMany({
          where: { id: { in: neighborIds }, deletedAt: null },
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
        })
      : [];

    const uniqueEdges = [
      ...new Map(
        edges.map((e) => [
          `${e.fromAssetId}:${e.toAssetId}:${e.relationType}`,
          e,
        ]),
      ).values(),
    ];

    return {
      root: this.serialize(root),
      depth: maxDepth,
      nodes: [
        { ...this.serialize(root), hop: 0 },
        ...neighbors.map((n) => ({
          ...this.serialize(n),
          hop: visited.get(n.id) ?? 0,
        })),
      ],
      edges: uniqueEdges,
      impactedCount: neighborIds.length,
    };
  }

  /**
   * Discovery / auto-import: upsert CIs from CSV text or JSON rows.
   * Optional relation rows: fromTag,toTag,relationType[,notes]
   */
  async discoveryImport(input: {
    csv?: string;
    assets?: Array<{
      assetTag: string;
      typeCode: string;
      name?: string;
      serialNumber?: string;
      manufacturer?: string;
      model?: string;
      status?: string;
      locationCode?: string;
      notes?: string;
    }>;
    relations?: Array<{
      fromTag: string;
      toTag: string;
      relationType: string;
      notes?: string;
    }>;
  }) {
    let assetRows = input.assets ?? [];
    let relationRows = input.relations ?? [];

    if (input.csv?.trim()) {
      const parsed = this.parseDiscoveryCsv(input.csv);
      assetRows = [...assetRows, ...parsed.assets];
      relationRows = [...relationRows, ...parsed.relations];
    }

    if (!assetRows.length && !relationRows.length) {
      throw new BadRequestException(
        'Provide csv text and/or assets[] / relations[] payloads',
      );
    }

    const locations = await this.prisma.location.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true },
    });
    const locByCode = new Map(
      locations.map((l) => [l.code.toUpperCase(), l.id]),
    );
    const types = await this.prisma.assetType.findMany();
    const typeByCode = new Map(types.map((t) => [t.code.toUpperCase(), t]));

    let created = 0;
    let updated = 0;
    const errors: string[] = [];
    const tagToId = new Map<string, string>();

    for (const [i, row] of assetRows.entries()) {
      try {
        const assetTag = row.assetTag?.trim().toUpperCase();
        const typeCode = row.typeCode?.trim().toUpperCase();
        if (!assetTag || assetTag.length < 2) {
          throw new Error('assetTag required');
        }
        if (!typeCode) throw new Error('typeCode required');
        const type = typeByCode.get(typeCode);
        if (!type) throw new Error(`Unknown typeCode ${typeCode}`);

        let locationId: string | null = null;
        if (row.locationCode?.trim()) {
          locationId =
            locByCode.get(row.locationCode.trim().toUpperCase()) ?? null;
          if (!locationId) {
            throw new Error(`Unknown locationCode ${row.locationCode}`);
          }
        }

        const status = this.normalizeStatus(row.status ?? 'in_stock');
        const existing = await this.prisma.asset.findUnique({
          where: { assetTag },
        });
        if (existing && !existing.deletedAt) {
          const asset = await this.prisma.asset.update({
            where: { id: existing.id },
            data: {
              name: row.name?.trim() || existing.name,
              typeId: type.id,
              serialNumber:
                row.serialNumber?.trim() || existing.serialNumber,
              manufacturer:
                row.manufacturer?.trim() || existing.manufacturer,
              model: row.model?.trim() || existing.model,
              status,
              locationId:
                locationId !== null ? locationId : existing.locationId,
              notes: row.notes?.trim() || existing.notes,
              source: 'discovery',
              deletedAt: null,
            },
          });
          tagToId.set(assetTag, asset.id);
          updated += 1;
        } else if (existing?.deletedAt) {
          const asset = await this.prisma.asset.update({
            where: { id: existing.id },
            data: {
              name: row.name?.trim() || null,
              typeId: type.id,
              serialNumber: row.serialNumber?.trim() || null,
              manufacturer: row.manufacturer?.trim() || null,
              model: row.model?.trim() || null,
              status,
              locationId,
              notes: row.notes?.trim() || null,
              source: 'discovery',
              deletedAt: null,
            },
          });
          tagToId.set(assetTag, asset.id);
          updated += 1;
        } else {
          const asset = await this.prisma.asset.create({
            data: {
              assetTag,
              name: row.name?.trim() || null,
              typeId: type.id,
              serialNumber: row.serialNumber?.trim() || null,
              manufacturer: row.manufacturer?.trim() || null,
              model: row.model?.trim() || null,
              status,
              locationId,
              notes: row.notes?.trim() || null,
              source: 'discovery',
            },
          });
          tagToId.set(assetTag, asset.id);
          created += 1;
        }
      } catch (e) {
        errors.push(`assets[${i}]: ${(e as Error).message}`);
      }
    }

    // Resolve tags that already exist but weren't in this batch
    const missingTags = new Set<string>();
    for (const r of relationRows) {
      const from = r.fromTag?.trim().toUpperCase();
      const to = r.toTag?.trim().toUpperCase();
      if (from && !tagToId.has(from)) missingTags.add(from);
      if (to && !tagToId.has(to)) missingTags.add(to);
    }
    if (missingTags.size) {
      const found = await this.prisma.asset.findMany({
        where: {
          assetTag: { in: [...missingTags] },
          deletedAt: null,
        },
        select: { id: true, assetTag: true },
      });
      for (const a of found) tagToId.set(a.assetTag, a.id);
    }

    let relationsCreated = 0;
    let relationsSkipped = 0;
    for (const [i, row] of relationRows.entries()) {
      try {
        const fromTag = row.fromTag?.trim().toUpperCase();
        const toTag = row.toTag?.trim().toUpperCase();
        if (!fromTag || !toTag) throw new Error('fromTag and toTag required');
        const fromId = tagToId.get(fromTag);
        const toId = tagToId.get(toTag);
        if (!fromId) throw new Error(`Unknown fromTag ${fromTag}`);
        if (!toId) throw new Error(`Unknown toTag ${toTag}`);
        if (fromId === toId) throw new Error('Self-relation not allowed');
        const relationType = this.normalizeRelationType(row.relationType);
        try {
          await this.prisma.assetRelation.create({
            data: {
              fromAssetId: fromId,
              toAssetId: toId,
              relationType,
              notes: row.notes?.trim() || null,
            },
          });
          relationsCreated += 1;
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
          ) {
            relationsSkipped += 1;
          } else {
            throw e;
          }
        }
      } catch (e) {
        errors.push(`relations[${i}]: ${(e as Error).message}`);
      }
    }

    return {
      created,
      updated,
      relationsCreated,
      relationsSkipped,
      errors,
    };
  }

  private parseDiscoveryCsv(csv: string): {
    assets: Array<{
      assetTag: string;
      typeCode: string;
      name?: string;
      serialNumber?: string;
      manufacturer?: string;
      model?: string;
      status?: string;
      locationCode?: string;
      notes?: string;
    }>;
    relations: Array<{
      fromTag: string;
      toTag: string;
      relationType: string;
      notes?: string;
    }>;
  } {
    const lines = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
    if (!lines.length) return { assets: [], relations: [] };

    const parseLine = (line: string): string[] => {
      const out: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i += 1;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          out.push(cur.trim());
          cur = '';
        } else {
          cur += ch;
        }
      }
      out.push(cur.trim());
      return out;
    };

    const header = parseLine(lines[0]).map((h) => h.toLowerCase());
    const isRelation =
      header.includes('fromtag') ||
      header.includes('from_tag') ||
      header.includes('totag') ||
      header.includes('to_tag');

    const assets: Array<{
      assetTag: string;
      typeCode: string;
      name?: string;
      serialNumber?: string;
      manufacturer?: string;
      model?: string;
      status?: string;
      locationCode?: string;
      notes?: string;
    }> = [];
    const relations: Array<{
      fromTag: string;
      toTag: string;
      relationType: string;
      notes?: string;
    }> = [];

    const idx = (names: string[]) => {
      for (const n of names) {
        const i = header.indexOf(n);
        if (i >= 0) return i;
      }
      return -1;
    };

    for (const line of lines.slice(1)) {
      const cols = parseLine(line);
      if (isRelation) {
        const fromTag = cols[idx(['fromtag', 'from_tag', 'from'])] ?? '';
        const toTag = cols[idx(['totag', 'to_tag', 'to'])] ?? '';
        const relationType =
          cols[idx(['relationtype', 'relation_type', 'type'])] ?? '';
        const notes = cols[idx(['notes', 'note'])] ?? '';
        if (!fromTag && !toTag) continue;
        relations.push({ fromTag, toTag, relationType, notes });
      } else {
        const assetTag = cols[idx(['assettag', 'asset_tag', 'tag'])] ?? '';
        const typeCode = cols[idx(['typecode', 'type_code', 'type'])] ?? '';
        if (!assetTag) continue;
        assets.push({
          assetTag,
          typeCode,
          name: cols[idx(['name', 'displayname', 'display_name'])] || undefined,
          serialNumber:
            cols[idx(['serialnumber', 'serial_number', 'serial'])] ||
            undefined,
          manufacturer: cols[idx(['manufacturer', 'make'])] || undefined,
          model: cols[idx(['model'])] || undefined,
          status: cols[idx(['status'])] || undefined,
          locationCode:
            cols[idx(['locationcode', 'location_code', 'location'])] ||
            undefined,
          notes: cols[idx(['notes', 'note'])] || undefined,
        });
      }
    }

    return { assets, relations };
  }
}
