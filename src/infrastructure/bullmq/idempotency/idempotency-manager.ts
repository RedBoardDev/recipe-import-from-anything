import { type IdempotencyKey, JobId, type UserId } from "@recipe/domain";
import type { Redis } from "ioredis";
import { IDEMPOTENCY_KEY_PREFIX, IDEMPOTENCY_TTL_MS } from "../../../constants.js";

/**
 * Manages idempotency operations for preventing duplicate jobs
 */
export class IdempotencyManager {
  constructor(private readonly redis: Redis) {}

  async check(userId: UserId, key: IdempotencyKey): Promise<JobId | null> {
    const redisKey = this.buildKey(userId, key);
    const existingJobId = await this.redis.get(redisKey);
    return existingJobId ? new JobId(existingJobId) : null;
  }

  async set(userId: UserId, key: IdempotencyKey, jobId: JobId): Promise<void> {
    const redisKey = this.buildKey(userId, key);
    await this.redis.set(redisKey, jobId.toString(), "PX", IDEMPOTENCY_TTL_MS);
  }

  async trySet(userId: UserId, key: IdempotencyKey, jobId: JobId): Promise<boolean> {
    const redisKey = this.buildKey(userId, key);
    const result = await this.redis.set(redisKey, jobId.toString(), "PX", IDEMPOTENCY_TTL_MS, "NX");
    return result === "OK";
  }

  async checkAndSet(userId: UserId, key: IdempotencyKey, jobId: JobId): Promise<JobId | null> {
    const existing = await this.check(userId, key);
    if (existing) {
      return existing;
    }
    await this.set(userId, key, jobId);
    return null;
  }

  private buildKey(userId: UserId, key: IdempotencyKey): string {
    return `${IDEMPOTENCY_KEY_PREFIX}:${userId.value}:${key.value}`;
  }
}
