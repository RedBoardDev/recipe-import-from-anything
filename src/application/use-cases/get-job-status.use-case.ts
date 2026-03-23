import type { JobId } from "@recipe/domain";
import type { JobProgress, JobStatus } from "../domain/job.types.js";
import type { QueuePort } from "../ports/queue.port.js";

export interface GetJobStatusResult {
  id: string;
  status: JobStatus;
  progress?: JobProgress;
  failedReason?: string;
  createdAt?: string;
}

export class GetJobStatusUseCase {
  constructor(private readonly queuePort: QueuePort) {}

  async execute(jobId: JobId): Promise<GetJobStatusResult | null> {
    const state = await this.queuePort.getJobState(jobId);
    if (!state) return null;

    return {
      id: jobId.toString(),
      status: state.status,
      ...(state.progress ? { progress: state.progress } : {}),
      ...(state.failedReason ? { failedReason: state.failedReason } : {}),
    };
  }
}
