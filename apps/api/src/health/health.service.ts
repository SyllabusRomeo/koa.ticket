import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  private redis: Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private getRedis(): Redis {
    if (!this.redis) {
      const url = this.config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379';
      this.redis = new Redis(url, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        enableOfflineQueue: false,
      });
    }
    return this.redis;
  }

  live() {
    return {
      status: 'ok',
      service: 'logit-api',
      timestamp: new Date().toISOString(),
    };
  }

  async ready() {
    const checks: Record<string, 'up' | 'down'> = {
      database: 'down',
      redis: 'down',
    };

    checks.database = (await this.prisma.isReady()) ? 'up' : 'down';

    try {
      const redis = this.getRedis();
      if (redis.status !== 'ready') {
        await redis.connect();
      }
      const pong = await redis.ping();
      checks.redis = pong === 'PONG' ? 'up' : 'down';
    } catch {
      checks.redis = 'down';
    }

    const ok = Object.values(checks).every((v) => v === 'up');
    return {
      status: ok ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  health() {
    return {
      status: 'ok',
      app: 'LogIt',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }
}
