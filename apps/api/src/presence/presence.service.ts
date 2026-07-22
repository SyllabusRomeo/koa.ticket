import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export type PresenceMode = 'viewing' | 'composing';

export type PresencePeer = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  mode: PresenceMode;
  updatedAt: string;
};

type PresenceUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

const TTL_SECONDS = 35;
const STALE_MS = 40_000;

@Injectable()
export class PresenceService implements OnModuleDestroy {
  private redis: Redis | null = null;
  private redisFailed = false;
  /** In-memory fallback when Redis is unavailable. */
  private readonly memory = new Map<string, Map<string, PresencePeer>>();

  constructor(private readonly config: ConfigService) {}

  async onModuleDestroy() {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        this.redis.disconnect();
      }
      this.redis = null;
    }
  }

  private getRedis(): Redis | null {
    if (this.redisFailed) return null;
    if (!this.redis) {
      const url = this.config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379';
      this.redis = new Redis(url, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        enableOfflineQueue: false,
        connectTimeout: 1500,
      });
      this.redis.on('error', () => {
        /* swallow — fall back to memory */
      });
    }
    return this.redis;
  }

  private async withRedis<T>(
    fn: (redis: Redis) => Promise<T>,
  ): Promise<T | null> {
    const redis = this.getRedis();
    if (!redis) return null;
    try {
      if (redis.status !== 'ready') {
        await redis.connect();
      }
      return await fn(redis);
    } catch {
      this.redisFailed = true;
      return null;
    }
  }

  private key(ticketId: string, userId: string) {
    return `logit:presence:ticket:${ticketId}:user:${userId}`;
  }

  private indexKey(ticketId: string) {
    return `logit:presence:ticket:${ticketId}:users`;
  }

  async heartbeat(
    ticketId: string,
    user: PresenceUser,
    mode: PresenceMode = 'viewing',
  ): Promise<{ peers: PresencePeer[]; self: PresencePeer }> {
    const entry: PresencePeer = {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      mode: mode === 'composing' ? 'composing' : 'viewing',
      updatedAt: new Date().toISOString(),
    };

    const viaRedis = await this.withRedis(async (redis) => {
      const pipe = redis.pipeline();
      pipe.set(this.key(ticketId, user.id), JSON.stringify(entry), 'EX', TTL_SECONDS);
      pipe.sadd(this.indexKey(ticketId), user.id);
      pipe.expire(this.indexKey(ticketId), TTL_SECONDS);
      await pipe.exec();
      return this.listFromRedis(redis, ticketId, user.id);
    });

    if (viaRedis) {
      return { peers: viaRedis, self: entry };
    }

    this.upsertMemory(ticketId, entry);
    return { peers: this.listFromMemory(ticketId, user.id), self: entry };
  }

  async list(ticketId: string, excludeUserId?: string): Promise<PresencePeer[]> {
    const viaRedis = await this.withRedis(async (redis) =>
      this.listFromRedis(redis, ticketId, excludeUserId),
    );
    if (viaRedis) return viaRedis;
    return this.listFromMemory(ticketId, excludeUserId);
  }

  async leave(ticketId: string, userId: string): Promise<void> {
    await this.withRedis(async (redis) => {
      await redis
        .pipeline()
        .del(this.key(ticketId, userId))
        .srem(this.indexKey(ticketId), userId)
        .exec();
    });
    const bucket = this.memory.get(ticketId);
    if (bucket) {
      bucket.delete(userId);
      if (bucket.size === 0) this.memory.delete(ticketId);
    }
  }

  private async listFromRedis(
    redis: Redis,
    ticketId: string,
    excludeUserId?: string,
  ): Promise<PresencePeer[]> {
    const userIds = await redis.smembers(this.indexKey(ticketId));
    if (userIds.length === 0) return [];

    const keys = userIds.map((id) => this.key(ticketId, id));
    const values = await redis.mget(...keys);
    const peers: PresencePeer[] = [];
    const stale: string[] = [];
    const now = Date.now();

    values.forEach((raw, i) => {
      const userId = userIds[i];
      if (!raw) {
        stale.push(userId);
        return;
      }
      try {
        const parsed = JSON.parse(raw) as PresencePeer;
        const age = now - new Date(parsed.updatedAt).getTime();
        if (Number.isNaN(age) || age > STALE_MS) {
          stale.push(userId);
          return;
        }
        if (excludeUserId && parsed.userId === excludeUserId) return;
        peers.push(parsed);
      } catch {
        stale.push(userId);
      }
    });

    if (stale.length) {
      const pipe = redis.pipeline();
      for (const id of stale) {
        pipe.del(this.key(ticketId, id));
        pipe.srem(this.indexKey(ticketId), id);
      }
      await pipe.exec();
    }

    return peers.sort((a, b) => a.lastName.localeCompare(b.lastName));
  }

  private upsertMemory(ticketId: string, entry: PresencePeer) {
    let bucket = this.memory.get(ticketId);
    if (!bucket) {
      bucket = new Map();
      this.memory.set(ticketId, bucket);
    }
    bucket.set(entry.userId, entry);
  }

  private listFromMemory(
    ticketId: string,
    excludeUserId?: string,
  ): PresencePeer[] {
    const bucket = this.memory.get(ticketId);
    if (!bucket) return [];
    const now = Date.now();
    const peers: PresencePeer[] = [];
    for (const [userId, entry] of bucket) {
      const age = now - new Date(entry.updatedAt).getTime();
      if (age > STALE_MS) {
        bucket.delete(userId);
        continue;
      }
      if (excludeUserId && entry.userId === excludeUserId) continue;
      peers.push(entry);
    }
    if (bucket.size === 0) this.memory.delete(ticketId);
    return peers.sort((a, b) => a.lastName.localeCompare(b.lastName));
  }
}
