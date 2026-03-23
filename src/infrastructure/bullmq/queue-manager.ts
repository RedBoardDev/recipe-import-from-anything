import type { IdempotencyKey, ImportResult, JobId, UserId } from "@recipe/domain";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import type { JobData, JobState } from "../../application/domain/job.types.js";
import type { QueuePort } from "../../application/ports/queue.port.js";
import { QUEUE_NAME } from "../../constants.js";
import { CancellationMonitor } from "./cancellation/cancellation-monitor.js";
import {
  getRedisConnectionOptions,
  getRemoveOnCompleteCount,
  getRemoveOnFailCount,
  getRetryAttempts,
  getRetryBackoffDelay,
  getRetryBackoffType,
  type RedisConnectionOptions,
} from "./config.js";
import { IdempotencyManager } from "./idempotency/idempotency-manager.js";
import { JobStateManager } from "./interfaces/job-state-manager.js";
import { QueueOperations } from "./interfaces/queue-operations.js";
import type { BullMQJobData } from "./types.js";

/**
 * Composite queue manager implementing QueuePort using modular components
 */
export class BullMQQueueManager implements QueuePort {
  private readonly queue: Queue<BullMQJobData>;
  private readonly redis: Redis;
  private readonly queueOperations: QueueOperations;
  private readonly stateManager: JobStateManager;
  private readonly idempotencyManager: IdempotencyManager;
  private readonly cancellationMonitor: CancellationMonitor;
  private readonly connectionOptions: RedisConnectionOptions;

  constructor() {
    this.connectionOptions = getRedisConnectionOptions();

    this.queue = new Queue<BullMQJobData>(QUEUE_NAME, {
      connection: this.connectionOptions,
      defaultJobOptions: {
        removeOnComplete: { count: getRemoveOnCompleteCount() },
        removeOnFail: { count: getRemoveOnFailCount() },
        attempts: getRetryAttempts(),
        backoff: {
          type: getRetryBackoffType(),
          delay: getRetryBackoffDelay(),
        },
      },
    });

    this.redis = new Redis(this.connectionOptions);

    this.queueOperations = new QueueOperations(this.queue);
    this.stateManager = new JobStateManager(this.queue);
    this.idempotencyManager = new IdempotencyManager(this.redis);
    this.cancellationMonitor = new CancellationMonitor(this.redis);
  }

  async enqueue(jobId: JobId, data: JobData): Promise<void> {
    await this.queueOperations.enqueue(jobId, data);
  }

  async getJobState(jobId: JobId): Promise<JobState | null> {
    return this.stateManager.getState(jobId);
  }

  async getJobResult(jobId: JobId): Promise<ImportResult | null> {
    return this.stateManager.getResult(jobId);
  }

  async cancel(jobId: JobId): Promise<{ canceled: boolean }> {
    const job = await this.queueOperations.getJob(jobId);
    if (!job) {
      return { canceled: false };
    }

    const state = await job.getState();

    if (state === "waiting" || state === "delayed" || state === "prioritized") {
      const removed = await this.queueOperations.removeJob(jobId);
      if (removed) {
        return { canceled: true };
      }
    }

    if (state === "active") {
      await this.cancellationMonitor.markCanceled(jobId);
      return { canceled: true };
    }

    return { canceled: false };
  }

  async isCanceled(jobId: JobId): Promise<boolean> {
    return this.cancellationMonitor.isCanceled(jobId);
  }

  async checkIdempotency(userId: UserId, key: IdempotencyKey): Promise<string | null> {
    const existing = await this.idempotencyManager.check(userId, key);
    return existing?.toString() ?? null;
  }

  async setIdempotency(userId: UserId, key: IdempotencyKey, jobId: JobId): Promise<void> {
    await this.idempotencyManager.set(userId, key, jobId);
  }

  async enqueueWithIdempotency(jobId: JobId, data: JobData): Promise<{ created: boolean; jobId: string }> {
    if (!data.idempotencyKey) {
      await this.enqueue(jobId, data);
      return { created: true, jobId: jobId.toString() };
    }

    const existing = await this.idempotencyManager.checkAndSet(data.userId, data.idempotencyKey, jobId);
    if (existing) {
      return { created: false, jobId: existing.toString() };
    }

    await this.enqueue(jobId, data);
    return { created: true, jobId: jobId.toString() };
  }

  async ping(): Promise<void> {
    await this.redis.ping();
  }

  async waitUntilReady(): Promise<void> {
    await this.queueOperations.waitUntilReady();
  }

  async close(): Promise<void> {
    await this.queueOperations.close();
    await this.redis.quit();
  }

  getQueueName(): string {
    return QUEUE_NAME;
  }

  getConnectionOptions(): RedisConnectionOptions {
    return { ...this.connectionOptions };
  }
}
