import type { JobId } from "@recipe/domain";
import type { QueuePort } from "../ports/queue.port.js";

export interface GetJobStatusResult {
  id: string;
  status: "queued" | "active" | "completed" | "failed" | "canceled";
  progress?: {
    stepId: string;
    stepLabel: string;
    stepCategory: "collecting" | "extracting" | "finalizing";
    status: "started" | "completed";
    stepIndex: number;
    totalSteps: number;
  };
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
      progress: state.progress,
      failedReason: state.failedReason,
    };
  }
}
