import type { JobId } from "@recipe/domain";
import type { Queue } from "bullmq";
import type { JobData, JobStatus } from "../../../application/domain/job.types.js";
import type { BullMQJobData } from "../types.js";

/**
 * Manages basic queue operations
 */
export class QueueOperations {
  constructor(private readonly queue: Queue<BullMQJobData>) {}

  async enqueue(jobId: JobId, data: JobData): Promise<void> {
    const bullMqData: BullMQJobData = {
      userId: data.userId.toString(),
      pipelineId: data.pipelineId,
      payload: data.payload,
      idempotencyKey: data.idempotencyKey?.value,
      inputRef: data.inputRef,
      debug: data.debug,
    };
    await this.queue.add(jobId.toString(), bullMqData, { jobId: jobId.toString() });
  }

  async getJob(jobId: JobId) {
    return this.queue.getJob(jobId.toString());
  }

  async removeJob(jobId: JobId): Promise<boolean> {
    try {
      const job = await this.getJob(jobId);
      if (job) {
        await job.remove();
        return true;
      }
    } catch {
      // Ignore errors
    }
    return false;
  }

  async waitUntilReady(): Promise<void> {
    await this.queue.waitUntilReady();
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

export function mapBullMQState(state: string, failedReason?: string): JobStatus {
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
