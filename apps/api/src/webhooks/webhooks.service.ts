import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  isWebhookEventType,
  WEBHOOK_EVENT_TYPES,
  type WebhookEventType,
} from './webhook-events';

const DELIVERY_TIMEOUT_MS = 10_000;
const DELIVERIES_KEEP_PER_ENDPOINT = 50;

export type WebhookEmitPayload = Record<string, unknown>;

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  isEnabled() {
    const raw = (this.config.get<string>('WEBHOOKS_ENABLED') ?? 'true')
      .trim()
      .toLowerCase();
    return raw !== '0' && raw !== 'false' && raw !== 'off' && raw !== 'no';
  }

  eventCatalog() {
    return WEBHOOK_EVENT_TYPES.filter((e) => e !== 'webhook.ping');
  }

  private parseEventTypes(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === 'string');
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.filter((v): v is string => typeof v === 'string');
        }
      } catch {
        /* ignore */
      }
    }
    return [];
  }

  private normalizeEventTypes(input: string[] | undefined): string[] {
    if (!input?.length) {
      throw new BadRequestException('Select at least one event type');
    }
    const unique = [...new Set(input.map((e) => e.trim()).filter(Boolean))];
    for (const e of unique) {
      if (!isWebhookEventType(e) || e === 'webhook.ping') {
        throw new BadRequestException(`Invalid event type: ${e}`);
      }
    }
    return unique;
  }

  private assertHttpsOrLocal(url: string) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid webhook URL');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('Webhook URL must be http or https');
    }
    return parsed.toString();
  }

  private maskSecret(secret: string) {
    if (secret.length <= 8) return '••••••••';
    return `••••${secret.slice(-4)}`;
  }

  private serializeEndpoint(
    row: {
      id: string;
      name: string;
      url: string;
      secret: string;
      isActive: boolean;
      eventTypes: Prisma.JsonValue;
      createdAt: Date;
      updatedAt: Date;
    },
    opts?: { includeSecret?: boolean },
  ) {
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      isActive: row.isActive,
      eventTypes: this.parseEventTypes(row.eventTypes),
      secretHint: this.maskSecret(row.secret),
      ...(opts?.includeSecret ? { secret: row.secret } : {}),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listEndpoints() {
    const rows = await this.prisma.webhookEndpoint.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.serializeEndpoint(r));
  }

  async createEndpoint(data: {
    name: string;
    url: string;
    eventTypes: string[];
    isActive?: boolean;
  }) {
    const url = this.assertHttpsOrLocal(data.url.trim());
    const eventTypes = this.normalizeEventTypes(data.eventTypes);
    const secret = randomBytes(32).toString('hex');
    const row = await this.prisma.webhookEndpoint.create({
      data: {
        name: data.name.trim(),
        url,
        secret,
        eventTypes,
        isActive: data.isActive ?? true,
      },
    });
    return this.serializeEndpoint(row, { includeSecret: true });
  }

  async updateEndpoint(
    id: string,
    data: {
      name?: string;
      url?: string;
      eventTypes?: string[];
      isActive?: boolean;
      rotateSecret?: boolean;
    },
  ) {
    const existing = await this.prisma.webhookEndpoint.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Webhook endpoint not found');

    const patch: Prisma.WebhookEndpointUpdateInput = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.url !== undefined) patch.url = this.assertHttpsOrLocal(data.url.trim());
    if (data.eventTypes !== undefined) {
      patch.eventTypes = this.normalizeEventTypes(data.eventTypes);
    }
    if (data.isActive !== undefined) patch.isActive = data.isActive;
    if (data.rotateSecret) patch.secret = randomBytes(32).toString('hex');

    const row = await this.prisma.webhookEndpoint.update({
      where: { id },
      data: patch,
    });
    return this.serializeEndpoint(row, {
      includeSecret: !!data.rotateSecret,
    });
  }

  async deleteEndpoint(id: string) {
    try {
      await this.prisma.webhookEndpoint.delete({ where: { id } });
    } catch {
      throw new NotFoundException('Webhook endpoint not found');
    }
    return { ok: true as const };
  }

  async listRecentDeliveries(endpointId: string, limit = 20) {
    const existing = await this.prisma.webhookEndpoint.findUnique({
      where: { id: endpointId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Webhook endpoint not found');
    const rows = await this.prisma.webhookDelivery.findMany({
      where: { endpointId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
    });
    return rows.map((r) => ({
      id: r.id,
      eventType: r.eventType,
      statusCode: r.statusCode,
      success: r.success,
      error: r.error,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /**
   * Fire-and-forget: schedule delivery without blocking the caller.
   * Failures are logged to WebhookDelivery; ticket ops never await this.
   */
  emit(eventType: WebhookEventType, payload: WebhookEmitPayload) {
    if (!this.isEnabled()) return;
    setImmediate(() => {
      void this.deliverAll(eventType, payload).catch((err) => {
        this.logger.error(
          `Webhook emit failed for ${eventType}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    });
  }

  async testPing(endpointId: string) {
    const endpoint = await this.prisma.webhookEndpoint.findUnique({
      where: { id: endpointId },
    });
    if (!endpoint) throw new NotFoundException('Webhook endpoint not found');
    const payload = {
      event: 'webhook.ping' as const,
      sentAt: new Date().toISOString(),
      endpointId: endpoint.id,
      message: 'LogIt webhook test ping',
    };
    const result = await this.deliverOne(endpoint, 'webhook.ping', payload);
    return {
      ok: result.success,
      deliveryId: result.deliveryId,
      statusCode: result.statusCode,
      error: result.error,
    };
  }

  private async deliverAll(
    eventType: WebhookEventType,
    payload: WebhookEmitPayload,
  ) {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { isActive: true },
    });
    const body = {
      ...payload,
      event: eventType,
      sentAt: new Date().toISOString(),
    };
    await Promise.allSettled(
      endpoints
        .filter((ep) => this.parseEventTypes(ep.eventTypes).includes(eventType))
        .map((ep) => this.deliverOne(ep, eventType, body)),
    );
  }

  private async deliverOne(
    endpoint: {
      id: string;
      url: string;
      secret: string;
    },
    eventType: string,
    payload: WebhookEmitPayload,
  ): Promise<{
    deliveryId: string;
    success: boolean;
    statusCode: number | null;
    error: string | null;
  }> {
    const deliveryId = randomUUID();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify(payload);
    const signatureHex = createHmac('sha256', endpoint.secret)
      .update(rawBody)
      .digest('hex');
    const signatureHeader = `sha256=${signatureHex}`;

    let statusCode: number | null = null;
    let success = false;
    let error: string | null = null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LogIt-Webhooks/1.0',
          'X-LogIt-Signature': signatureHeader,
          'X-LogIt-Event': eventType,
          'X-LogIt-Delivery-Id': deliveryId,
          'X-LogIt-Timestamp': timestamp,
        },
        body: rawBody,
        signal: controller.signal,
      });
      statusCode = res.status;
      success = res.status >= 200 && res.status < 300;
      if (!success) {
        error = `HTTP ${res.status}`;
      }
    } catch (err) {
      error =
        err instanceof Error
          ? err.name === 'AbortError'
            ? 'Delivery timed out (10s)'
            : err.message
          : String(err);
      this.logger.warn(
        `Webhook delivery ${deliveryId} to ${endpoint.url} failed: ${error}`,
      );
    } finally {
      clearTimeout(timer);
    }

    try {
      await this.prisma.webhookDelivery.create({
        data: {
          id: deliveryId,
          endpointId: endpoint.id,
          eventType,
          payload: rawBody.slice(0, 16_000),
          statusCode,
          success,
          error,
        },
      });
      await this.pruneDeliveries(endpoint.id);
    } catch (logErr) {
      this.logger.error(
        `Failed to log webhook delivery: ${logErr instanceof Error ? logErr.message : String(logErr)}`,
      );
    }

    return { deliveryId, success, statusCode, error };
  }

  private async pruneDeliveries(endpointId: string) {
    const keep = await this.prisma.webhookDelivery.findMany({
      where: { endpointId },
      orderBy: { createdAt: 'desc' },
      take: DELIVERIES_KEEP_PER_ENDPOINT,
      select: { id: true },
    });
    if (keep.length < DELIVERIES_KEEP_PER_ENDPOINT) return;
    await this.prisma.webhookDelivery.deleteMany({
      where: {
        endpointId,
        id: { notIn: keep.map((k) => k.id) },
      },
    });
  }
}
