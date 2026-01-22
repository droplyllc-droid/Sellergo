import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('redis.url');

    this.client = new Redis(redisUrl ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          this.logger.error('Redis connection failed after 3 retries');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
      enableReadyCheck: true,
      lazyConnect: false,
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis error:', error);
    });

    this.client.on('close', () => {
      this.logger.warn('Redis connection closed');
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
    this.logger.log('Redis disconnected');
  }

  /**
   * Get the raw Redis client
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Set a value with optional expiry
   */
  async set(
    key: string,
    value: string | number | Buffer,
    ttlSeconds?: number
  ): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  /**
   * Get a value
   */
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  /**
   * Delete multiple keys by pattern
   */
  async delByPattern(pattern: string): Promise<number> {
    const keys = await this.client.keys(pattern);
    if (keys.length === 0) return 0;
    return this.client.del(...keys);
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Set expiry on existing key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }

  /**
   * Get TTL of a key
   */
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  /**
   * Increment a counter
   */
  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  /**
   * Increment with expiry (for rate limiting)
   */
  async incrWithExpiry(key: string, ttlSeconds: number): Promise<number> {
    const multi = this.client.multi();
    multi.incr(key);
    multi.expire(key, ttlSeconds);
    const results = await multi.exec();
    return (results?.[0]?.[1] as number) ?? 0;
  }

  /**
   * Set JSON data
   */
  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  /**
   * Get JSON data
   */
  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Hash set
   */
  async hset(
    key: string,
    field: string,
    value: string | number
  ): Promise<number> {
    return this.client.hset(key, field, value);
  }

  /**
   * Hash get
   */
  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  /**
   * Hash get all
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  /**
   * Hash delete
   */
  async hdel(key: string, field: string): Promise<number> {
    return this.client.hdel(key, field);
  }

  /**
   * Add to set
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.client.sadd(key, ...members);
  }

  /**
   * Get set members
   */
  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  /**
   * Check if member exists in set
   */
  async sismember(key: string, member: string): Promise<boolean> {
    const result = await this.client.sismember(key, member);
    return result === 1;
  }

  /**
   * Remove from set
   */
  async srem(key: string, ...members: string[]): Promise<number> {
    return this.client.srem(key, ...members);
  }

  /**
   * Publish message to channel
   */
  async publish(channel: string, message: string): Promise<number> {
    return this.client.publish(channel, message);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // CACHE HELPERS
  // ==========================================================================

  /**
   * Get or set cache with callback
   */
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>
  ): Promise<T> {
    const cached = await this.getJson<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.setJson(key, value, ttlSeconds);
    return value;
  }

  /**
   * Invalidate cache by prefix
   */
  async invalidateByPrefix(prefix: string): Promise<void> {
    await this.delByPattern(`${prefix}*`);
  }

  // ==========================================================================
  // RATE LIMITING HELPERS
  // ==========================================================================

  /**
   * Check and increment rate limit
   * Returns { allowed: boolean, remaining: number, reset: number }
   */
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{
    allowed: boolean;
    remaining: number;
    reset: number;
  }> {
    const current = await this.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= limit) {
      const ttl = await this.ttl(key);
      return {
        allowed: false,
        remaining: 0,
        reset: ttl > 0 ? ttl : windowSeconds,
      };
    }

    const newCount = await this.incrWithExpiry(key, windowSeconds);
    return {
      allowed: true,
      remaining: Math.max(0, limit - newCount),
      reset: windowSeconds,
    };
  }

  // ==========================================================================
  // SESSION HELPERS
  // ==========================================================================

  /**
   * Store session data
   */
  async setSession(
    sessionId: string,
    data: Record<string, unknown>,
    ttlSeconds: number
  ): Promise<void> {
    await this.setJson(`session:${sessionId}`, data, ttlSeconds);
  }

  /**
   * Get session data
   */
  async getSession(
    sessionId: string
  ): Promise<Record<string, unknown> | null> {
    return this.getJson(`session:${sessionId}`);
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.del(`session:${sessionId}`);
  }

  /**
   * Add session to user's active sessions
   */
  async addUserSession(
    userId: string,
    sessionId: string,
    ttlSeconds: number
  ): Promise<void> {
    await this.sadd(`user:${userId}:sessions`, sessionId);
    await this.expire(`user:${userId}:sessions`, ttlSeconds);
  }

  /**
   * Get user's active sessions
   */
  async getUserSessions(userId: string): Promise<string[]> {
    return this.smembers(`user:${userId}:sessions`);
  }

  /**
   * Remove session from user's active sessions
   */
  async removeUserSession(userId: string, sessionId: string): Promise<void> {
    await this.srem(`user:${userId}:sessions`, sessionId);
    await this.deleteSession(sessionId);
  }

  /**
   * Invalidate all user sessions
   */
  async invalidateAllUserSessions(userId: string): Promise<void> {
    const sessions = await this.getUserSessions(userId);
    for (const sessionId of sessions) {
      await this.deleteSession(sessionId);
    }
    await this.del(`user:${userId}:sessions`);
  }
}
