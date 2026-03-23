import type { ImportResult, JobId } from "@recipe/domain";
import type { Queue } from "bullmq";
import type { JobState } from "../../../application/domain/job.types.js";
import { parseStoredJobProgress } from "../progress-state.js";
import { mapBullMQState } from "./queue-operations.js";

/**
 * Manages job state queries and mapping
 */
export class JobStateManager {
  constructor(private readonly queue: Queue) {}

  async getState(jobId: JobId): Promise<JobState | null> {
    const job = await this.queue.getJob(jobId.toString());
    if (!job) return null;

    const state = await job.getState();
    const status = mapBullMQState(state, job.failedReason);
    const progress = this.extractProgress(job);

    return {
      status,
      progress,
      failedReason: job.failedReason ?? undefined,
    };
  }

  async getResult(jobId: JobId): Promise<ImportResult | null> {
    const job = await this.queue.getJob(jobId.toString());
    if (!job) return null;

    const rv = job.returnvalue;
    if (!rv || typeof rv !== "object") return null;

    return rv as ImportResult;
  }

  isCancelable(state: string): boolean {
    return state === "waiting" || state === "delayed" || state === "prioritized" || state === "active";
  }

  private extractProgress(job: Readonly<{ progress?: unknown }>) {
    return parseStoredJobProgress(job.progress);
  }
}
