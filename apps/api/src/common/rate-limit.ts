import { createHash } from 'node:crypto';
import { type CanActivate, type ExecutionContext, HttpException, Inject, Injectable, type OnModuleDestroy, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { Redis } from 'ioredis';
import { config } from '../config.js';

/**
 * Per-route request limits (fixed windows). `ip` counts per client address (the real one behind the load
 * balancer: `trust proxy` is on); `key` counts per partner API key.
 */
export const BUCKETS = {
  /** Every route without a tighter bucket. */
  default: { limit: 300, windowSec: 60, by: 'ip' },
  /** Sign-in, sign-up and every code or passkey check: slows down guessing. */
  auth: { limit: 20, windowSec: 60, by: 'ip' },
  /** A provider's own system, per API key. */
  partnerApi: { limit: 120, windowSec: 60, by: 'key' },
  /** Bulk quote imports from the portal. */
  import: { limit: 20, windowSec: 60, by: 'ip' },
} as const;
export type Bucket = keyof typeof BUCKETS;

const KEY = 'klyr:rate-limit';
/** Use a tighter bucket than `default` on a route or controller. */
export const RateLimit = (bucket: Bucket) => SetMetadata(KEY, bucket);

interface Store { hit(key: string, windowSec: number): Promise<{ count: number; resetSec: number }>; close(): Promise<void> }

class MemoryStore implements Store {
  private readonly windows = new Map<string, { count: number; until: number }>();
  async hit(key: string, windowSec: number) {
    const now = Date.now();
    let w = this.windows.get(key);
    if (!w || w.until <= now) { w = { count: 0, until: now + windowSec * 1000 }; this.windows.set(key, w); }
    w.count++;
    if (this.windows.size > 50_000) for (const [k, v] of this.windows) if (v.until <= now) this.windows.delete(k);
    return { count: w.count, resetSec: Math.ceil((w.until - now) / 1000) };
  }
  async close() {}
}

class RedisStore implements Store {
  private readonly redis: Redis;
  constructor(url: string) { this.redis = new Redis(url, { maxRetriesPerRequest: 1, enableOfflineQueue: false }); }
  async hit(key: string, windowSec: number) {
    const k = `rl:${key}`;
    const [[, count], [, ttl]] = (await this.redis.multi().incr(k).ttl(k).exec()) as [[null, number], [null, number]];
    if (ttl < 0) await this.redis.expire(k, windowSec);
    return { count, resetSec: ttl > 0 ? ttl : windowSec };
  }
  async close() { await this.redis.quit(); }
}

@Injectable()
export class RateLimitGuard implements CanActivate, OnModuleDestroy {
  private readonly store: Store;
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {
    if (config.production && !config.rateLimit.redisUrl) throw new Error('REDIS_URL is required in production, so every API server shares request limits');
    this.store = config.rateLimit.redisUrl ? new RedisStore(config.rateLimit.redisUrl) : new MemoryStore();
  }

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (req.path === '/health') return true;
    const name = this.reflector.getAllAndOverride<Bucket>(KEY, [ctx.getHandler(), ctx.getClass()]) ?? 'default';
    const b = BUCKETS[name];
    const who = b.by === 'key' ? createHash('sha256').update(req.headers.authorization ?? req.ip ?? '').digest('hex').slice(0, 32) : req.ip ?? 'unknown';
    const limit = Math.max(1, Math.round(b.limit * config.rateLimit.scale));
    let hit: { count: number; resetSec: number };
    try { hit = await this.store.hit(`${name}:${who}`, b.windowSec); } catch { return true; } // Redis down: don't take the site with it.
    const res = ctx.switchToHttp().getResponse<Response>();
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - hit.count)));
    if (hit.count > limit) {
      res.setHeader('Retry-After', String(hit.resetSec));
      throw new HttpException({ code: 'rate_limited', message: `Too many requests. Try again in ${hit.resetSec} seconds.` }, 429);
    }
    return true;
  }

  async onModuleDestroy() { await this.store.close(); }
}
