import { IdempotencyKey, JobId, type UserId } from "@recipe/domain";
import type { JobData, PipelineId } from "../domain/job.types.js";
import type { LoggerPort } from "../ports/logger.port.js";
import type { QueuePort } from "../ports/queue.port.js";

export interface CreateImportJobInput {
  pipelineId: PipelineId;
  payload: unknown;
  inputRef?: string;
  idempotencyKey?: string;
  debug?: boolean;
}

export interface CreateImportJobResult {
  jobId: JobId;
  isDuplicate: boolean;
}

export class CreateImportJobUseCase {
  constructor(
    private readonly queuePort: QueuePort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(userId: UserId, input: CreateImportJobInput): Promise<CreateImportJobResult> {
    const idempotencyKey = input.idempotencyKey ? new IdempotencyKey(input.idempotencyKey) : undefined;

    const jobId = new JobId();
    const jobData: JobData = {
      userId,
      pipelineId: input.pipelineId,
      payload: input.payload,
      idempotencyKey,
      inputRef: input.inputRef,
      debug: input.debug,
    };

    const result = await this.queuePort.enqueueWithIdempotency(jobId, jobData);

    if (!result.created) {
      this.logger.info("Duplicate job request", {
        jobId: result.jobId,
        userId: userId.toString(),
      });
      return { jobId: new JobId(result.jobId), isDuplicate: true };
    }

    this.logger.info("Job created", {
      jobId: result.jobId,
      pipelineId: input.pipelineId,
      userId: userId.toString(),
    });

    return { jobId, isDuplicate: false };
  }
}
