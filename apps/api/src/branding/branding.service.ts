import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, existsSync, mkdirSync, unlinkSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join, extname } from 'path';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUserView } from '../auth/auth.service';

const KEYS = {
  logoStored: 'branding.logoStoredName',
  logoMime: 'branding.logoMime',
  bannerStored: 'branding.bannerStoredName',
  bannerMime: 'branding.bannerMime',
} as const;

const LOGO_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'svg']);
const BANNER_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp']);
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const BANNER_MAX_BYTES = 5 * 1024 * 1024;

@Injectable()
export class BrandingService {
  private readonly uploadDir: string;
  private readonly apiPublicUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.uploadDir = config.get('UPLOAD_DIR') ?? './data/uploads';
    this.apiPublicUrl = (
      config.get('API_PUBLIC_URL') ?? 'http://localhost:4100/api/v1'
    ).replace(/\/$/, '');
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  private assetUrl(kind: 'logo' | 'banner') {
    return `${this.apiPublicUrl}/branding/assets/${kind}`;
  }

  private async getSetting(key: string) {
    return this.prisma.systemSetting.findUnique({ where: { key } });
  }

  private async upsertSetting(key: string, value: string) {
    return this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  private async deleteSetting(key: string) {
    await this.prisma.systemSetting.deleteMany({ where: { key } });
  }

  private safeUnlink(storedName: string | null | undefined) {
    if (!storedName) return;
    const path = join(this.uploadDir, storedName);
    if (existsSync(path)) {
      try {
        unlinkSync(path);
      } catch {
        /* ignore */
      }
    }
  }

  async getPublic() {
    const [logo, banner, logoRow, bannerRow] = await Promise.all([
      this.getSetting(KEYS.logoStored),
      this.getSetting(KEYS.bannerStored),
      this.getSetting(KEYS.logoMime),
      this.getSetting(KEYS.bannerMime),
    ]);

    const timestamps = [logo?.updatedAt, banner?.updatedAt].filter(
      Boolean,
    ) as Date[];
    const updatedAt =
      timestamps.length > 0
        ? new Date(Math.max(...timestamps.map((d) => d.getTime()))).toISOString()
        : null;

    return {
      logoUrl: logo?.value ? this.assetUrl('logo') : null,
      loginBannerUrl: banner?.value ? this.assetUrl('banner') : null,
      hasLogo: Boolean(logo?.value),
      hasBanner: Boolean(banner?.value),
      logoMime: logoRow?.value ?? null,
      bannerMime: bannerRow?.value ?? null,
      updatedAt,
      limits: {
        logo: {
          maxBytes: LOGO_MAX_BYTES,
          extensions: [...LOGO_EXTS].sort(),
        },
        banner: {
          maxBytes: BANNER_MAX_BYTES,
          extensions: [...BANNER_EXTS].sort(),
        },
      },
    };
  }

  async streamAsset(kind: 'logo' | 'banner') {
    const storedKey = kind === 'logo' ? KEYS.logoStored : KEYS.bannerStored;
    const mimeKey = kind === 'logo' ? KEYS.logoMime : KEYS.bannerMime;
    const stored = await this.getSetting(storedKey);
    if (!stored?.value) throw new NotFoundException(`${kind} not configured`);

    const path = join(this.uploadDir, stored.value);
    if (!existsSync(path)) throw new NotFoundException(`${kind} file missing`);

    const mime = await this.getSetting(mimeKey);
    return {
      file: new StreamableFile(createReadStream(path)),
      mimeType: mime?.value || 'application/octet-stream',
      filename: stored.value,
    };
  }

  private validate(
    file: Express.Multer.File,
    kind: 'logo' | 'banner',
  ) {
    if (!file) throw new BadRequestException('File required');
    const max = kind === 'logo' ? LOGO_MAX_BYTES : BANNER_MAX_BYTES;
    const allowed = kind === 'logo' ? LOGO_EXTS : BANNER_EXTS;
    if (file.size > max) {
      throw new BadRequestException(
        `File too large (max ${Math.round(max / 1024 / 1024)} MB)`,
      );
    }
    const ext = extname(file.originalname).replace('.', '').toLowerCase();
    if (!allowed.has(ext)) {
      throw new BadRequestException(
        `Extension .${ext} not allowed for ${kind}. Allowed: ${[...allowed].join(', ')}`,
      );
    }
    return ext;
  }

  async uploadLogo(user: AuthUserView, file: Express.Multer.File, ip?: string) {
    const ext = this.validate(file, 'logo');
    const prev = await this.getSetting(KEYS.logoStored);
    const storedName = `branding-logo-${randomBytes(12).toString('hex')}.${ext}`;
    await writeFile(join(this.uploadDir, storedName), file.buffer);
    await this.upsertSetting(KEYS.logoStored, storedName);
    await this.upsertSetting(
      KEYS.logoMime,
      file.mimetype || (ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`),
    );
    this.safeUnlink(prev?.value);

    await this.audit.log({
      actorId: user.id,
      action: 'branding.logo_upload',
      entityType: 'system_settings',
      entityId: KEYS.logoStored,
      after: { storedName, originalName: file.originalname },
      ipAddress: ip,
    });

    return this.getPublic();
  }

  async uploadBanner(
    user: AuthUserView,
    file: Express.Multer.File,
    ip?: string,
  ) {
    const ext = this.validate(file, 'banner');
    const prev = await this.getSetting(KEYS.bannerStored);
    const storedName = `branding-banner-${randomBytes(12).toString('hex')}.${ext}`;
    await writeFile(join(this.uploadDir, storedName), file.buffer);
    await this.upsertSetting(KEYS.bannerStored, storedName);
    await this.upsertSetting(
      KEYS.bannerMime,
      file.mimetype || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    );
    this.safeUnlink(prev?.value);

    await this.audit.log({
      actorId: user.id,
      action: 'branding.banner_upload',
      entityType: 'system_settings',
      entityId: KEYS.bannerStored,
      after: { storedName, originalName: file.originalname },
      ipAddress: ip,
    });

    return this.getPublic();
  }

  async reset(user: AuthUserView, ip?: string) {
    const [logo, banner] = await Promise.all([
      this.getSetting(KEYS.logoStored),
      this.getSetting(KEYS.bannerStored),
    ]);
    this.safeUnlink(logo?.value);
    this.safeUnlink(banner?.value);
    await Promise.all([
      this.deleteSetting(KEYS.logoStored),
      this.deleteSetting(KEYS.logoMime),
      this.deleteSetting(KEYS.bannerStored),
      this.deleteSetting(KEYS.bannerMime),
    ]);

    await this.audit.log({
      actorId: user.id,
      action: 'branding.reset',
      entityType: 'system_settings',
      entityId: 'branding',
      before: {
        hadLogo: Boolean(logo?.value),
        hadBanner: Boolean(banner?.value),
      },
      ipAddress: ip,
    });

    return this.getPublic();
  }
}
