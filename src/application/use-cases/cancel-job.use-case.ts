import type { JobId } from "@recipe/domain";
import type { LoggerPort } from "../ports/logger.port.js";
import type { QueuePort } from "../ports/queue.port.js";

export interface CancelJobResult {
  jobId: string;
  status: "queued" | "active" | "completed" | "failed" | "canceled";
  success: boolean;
  notFound?: boolean;
}

export class CancelJobUseCase {
  constructor(
    private readonly queuePort: QueuePort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(jobId: JobId): Promise<CancelJobResult> {
    const state = await this.queuePort.getJobState(jobId);

    if (!state) {
      return { jobId: jobId.toString(), status: "failed", success: false, notFound: true };
    }

    if (state.status === "completed" || state.status === "canceled") {
      return { jobId: jobId.toString(), status: state.status, success: false };
    }

    const { canceled } = await this.queuePort.cancel(jobId);
    if (canceled) {
      this.logger.info("Job canceled", { jobId: jobId.toString() });
      return { jobId: jobId.toString(), status: "canceled", success: true };
    }

    const currentState = await this.queuePort.getJobState(jobId);
    return {
      jobId: jobId.toString(),
      status: currentState?.status ?? "failed",
      success: false,
    };
  }
}
