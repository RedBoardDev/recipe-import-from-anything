import { IdempotencyKey, JobId, type UserId } from "@recipe/domain";
import type { BullMQJobData } from "../../infrastructure/bullmq/types.js";
import type { LoggerPort } from "../ports/logger.port.js";
import type { QueuePort } from "../ports/queue.port.js";

export interface CreateImportJobInput {
  pipelineId: string;
  payload: unknown;
  inputRef?: string;
  idempotencyKey?: string;
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

    if (idempotencyKey) {
      const existingJobId = await this.queuePort.checkIdempotency(userId, idempotencyKey);
      if (existingJobId) {
        this.logger.info("Duplicate job request", {
          jobId: existingJobId,
          userId: userId.toString(),
        });
        return { jobId: new JobId(existingJobId), isDuplicate: true };
      }
    }

    const jobId = new JobId();
    const bullmqData: BullMQJobData = {
      userId: userId.toString(),
      pipelineId: input.pipelineId,
      payload: input.payload,
      idempotencyKey: idempotencyKey?.value,
      inputRef: input.inputRef,
    };

    await this.queuePort.enqueue(jobId, bullmqData);

    if (idempotencyKey) {
      await this.queuePort.setIdempotency(userId, idempotencyKey, jobId);
    }

    this.logger.info("Job created", {
      jobId: jobId.toString(),
      pipelineId: input.pipelineId,
      userId: userId.toString(),
    });

    return { jobId, isDuplicate: false };
  }
}
