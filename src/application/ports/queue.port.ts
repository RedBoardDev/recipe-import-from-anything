import type { IdempotencyKey, ImportResult, JobId, UserId } from "@recipe/domain";
import type { BullMQJobData, JobStateResult } from "../../infrastructure/bullmq/types.js";

export interface QueuePort {
  enqueue(jobId: JobId, data: BullMQJobData): Promise<void>;
  getJobState(jobId: JobId): Promise<JobStateResult | null>;
  getJobResult(jobId: JobId): Promise<ImportResult | null>;
  cancel(jobId: JobId): Promise<{ canceled: boolean }>;
  isCanceled(jobId: JobId): Promise<boolean>;
  checkIdempotency(userId: UserId, key: IdempotencyKey): Promise<string | null>;
  setIdempotency(userId: UserId, key: IdempotencyKey, jobId: JobId): Promise<void>;
  enqueueWithIdempotency(jobId: JobId, data: BullMQJobData): Promise<{ created: boolean; jobId: string }>;
  ping(): Promise<void>;
}
