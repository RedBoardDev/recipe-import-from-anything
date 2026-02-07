import type { IdempotencyKey, ImportResult, JobId, UserId } from "@recipe/domain";
import type { StepCategory } from "@recipe/pipeline-contracts";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import type { QueuePort } from "../../application/ports.js";
import {
  CANCELLATION_KEY_PREFIX,
  CANCELLATION_TTL_MS,
  IDEMPOTENCY_KEY_PREFIX,
  IDEMPOTENCY_TTL_MS,
  QUEUE_NAME,
} from "../../constants.js";
import {
  getRedisConnectionOptions,
  getRemoveOnCompleteCount,
  getRemoveOnFailCount,
  getRetryAttempts,
  getRetryBackoffDelay,
  getRetryBackoffType,
  type RedisConnectionOptions,
} from "./config.js";
import type { ApiJobStatus, BullMQJobData, JobStateResult } from "./types.js";

function mapBullMQState(state: string, failedReason?: string): ApiJobStatus {
  switch (state) {
    case "waiting":
    case "delayed":
    case "prioritized":
    case "wait":
      return "queued";
    case "active":
      return "active";
    case "completed":
      return "completed";
    case "failed":
      return failedReason?.includes("canceled") ? "canceled" : "failed";
    default:
      return "queued";
  }
}

const isStepCategory = (value: unknown): value is StepCategory =>
  value === "collecting" || value === "extracting" || value === "finalizing";

export class BullMQQueue implements QueuePort {
  private readonly queue: Queue<BullMQJobData>;
  private readonly redis: Redis;
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
  }

  getQueueName(): string {
    return QUEUE_NAME;
  }

  getConnectionOptions(): RedisConnectionOptions {
    return { ...this.connectionOptions };
  }

  async waitUntilReady(): Promise<void> {
    await this.queue.waitUntilReady();
    await this.redis.ping();
  }

  async enqueue(jobId: JobId, data: BullMQJobData): Promise<void> {
    await this.queue.add(jobId.toString(), data, { jobId: jobId.toString() });
  }

  async cancel(jobId: JobId): Promise<{ canceled: boolean }> {
    const id = jobId.toString();
    const job = await this.queue.getJob(id);

    if (!job) return { canceled: false };

    const state = await job.getState();

    if (state === "waiting" || state === "delayed" || state === "prioritized") {
      try {
        await job.remove();
        return { canceled: true };
      } catch {}
    }

    if (state === "active") {
      await this.redis.set(this.getCancelKey(id), "1", "PX", CANCELLATION_TTL_MS);
      return { canceled: true };
    }

    return { canceled: false };
  }

  async isCanceled(jobId: JobId): Promise<boolean> {
    const exists = await this.redis.exists(this.getCancelKey(jobId.toString()));
    return exists > 0;
  }

  async getJobState(jobId: JobId): Promise<JobStateResult | null> {
    const job = await this.queue.getJob(jobId.toString());
    if (!job) return null;

    const state = await job.getState();
    const status = mapBullMQState(state, job.failedReason);

    let progress: JobStateResult["progress"] | undefined;
    if (job.progress && typeof job.progress === "object") {
      const prog = job.progress as Record<string, unknown>;
      if (prog.stepId && typeof prog.stepId === "string") {
        progress = {
          stepId: prog.stepId,
          stepLabel: typeof prog.stepLabel === "string" && prog.stepLabel.length > 0 ? prog.stepLabel : prog.stepId,
          stepCategory: isStepCategory(prog.stepCategory) ? prog.stepCategory : "extracting",
          status: prog.status === "started" || prog.status === "completed" ? prog.status : "started",
          stepIndex: typeof prog.stepIndex === "number" ? prog.stepIndex : 0,
          totalSteps: typeof prog.totalSteps === "number" ? prog.totalSteps : 3,
        };
      }
    }

    return {
      status,
      progress,
      failedReason: job.failedReason ?? undefined,
    };
  }

  async getJobResult(jobId: JobId): Promise<ImportResult | null> {
    const job = await this.queue.getJob(jobId.toString());
    if (!job) return null;

    const rv = job.returnvalue;
    if (!rv || typeof rv !== "object") return null;

    return rv as ImportResult;
  }

  async checkIdempotency(userId: UserId, key: IdempotencyKey): Promise<string | null> {
    return this.redis.get(this.getIdempotencyKey(userId, key));
  }

  async setIdempotency(userId: UserId, key: IdempotencyKey, jobId: JobId): Promise<void> {
    await this.redis.set(this.getIdempotencyKey(userId, key), jobId.toString(), "PX", IDEMPOTENCY_TTL_MS);
  }

  async enqueueWithIdempotency(jobId: JobId, data: BullMQJobData): Promise<{ created: boolean; jobId: string }> {
    const redis = this.redis;
    const key = `idem:${data.userId}:${data.idempotencyKey}`;

    if (!data.idempotencyKey) {
      await this.enqueue(jobId, data);
      return { created: true, jobId: jobId.toString() };
    }

    const setResult = await redis.set(key, jobId.toString(), "PX", IDEMPOTENCY_TTL_MS, "NX");

    if (setResult === "OK") {
      await this.enqueue(jobId, data);
      return { created: true, jobId: jobId.toString() };
    }

    const existingJobId = await redis.get(key);
    return { created: false, jobId: existingJobId || "" };
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.redis.quit();
  }

  async ping(): Promise<void> {
    await this.redis.ping();
  }

  private getCancelKey(jobId: string): string {
    return `${CANCELLATION_KEY_PREFIX}:${jobId}`;
  }

  private getIdempotencyKey(userId: UserId, key: IdempotencyKey): string {
    return `${IDEMPOTENCY_KEY_PREFIX}:${userId.value}:${key.value}`;
  }
}
