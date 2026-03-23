import type { JobId } from "@recipe/domain";
import type { Redis } from "ioredis";
import { CANCELLATION_KEY_PREFIX, CANCELLATION_TTL_MS } from "../../../constants.js";

/**
 * Manages job cancellation operations
 */
export class CancellationMonitor {
  constructor(private readonly redis: Redis) {}

  async markCanceled(jobId: JobId): Promise<void> {
    const key = this.buildKey(jobId);
    await this.redis.set(key, "1", "PX", CANCELLATION_TTL_MS);
  }

  async isCanceled(jobId: JobId): Promise<boolean> {
    const key = this.buildKey(jobId);
    const exists = await this.redis.exists(key);
    return exists > 0;
  }

  async clear(jobId: JobId): Promise<void> {
    const key = this.buildKey(jobId);
    await this.redis.del(key);
  }

  private buildKey(jobId: JobId): string {
    return `${CANCELLATION_KEY_PREFIX}:${jobId.toString()}`;
  }
}
