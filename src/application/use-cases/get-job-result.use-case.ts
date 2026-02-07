import type { ImportResult, JobId } from "@recipe/domain";
import type { QueuePort } from "../ports/queue.port.js";

export interface GetJobResultResult {
  jobId: string;
  status: "queued" | "active" | "completed" | "failed" | "canceled";
  result?: ImportResult;
}

export class GetJobResultUseCase {
  constructor(private readonly queuePort: QueuePort) {}

  async execute(jobId: JobId): Promise<GetJobResultResult | null> {
    const state = await this.queuePort.getJobState(jobId);

    if (!state) {
      return null;
    }

    if (state.status === "queued" || state.status === "active") {
      return { jobId: jobId.toString(), status: state.status };
    }

    if (state.status === "canceled") {
      return { jobId: jobId.toString(), status: "canceled" };
    }

    if (state.status === "failed") {
      return { jobId: jobId.toString(), status: "failed" };
    }

    const result = await this.queuePort.getJobResult(jobId);
    return { jobId: jobId.toString(), status: "completed", result: result ?? undefined };
  }
}
