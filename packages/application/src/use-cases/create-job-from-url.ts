import { randomUUID } from "node:crypto";
import type { ImportJob, ImportOptions } from "@ria/domain";
import type { JobQueue, JobRepository } from "../ports/index";

export interface CreateJobFromUrlInput {
  userId: string;
  url: string;
  options: ImportOptions;
}

const nowIso = (): string => new Date().toISOString();

export class CreateJobFromUrl {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly jobQueue: JobQueue
  ) {}

  async execute(input: CreateJobFromUrlInput): Promise<ImportJob> {
    const now = nowIso();

    const job: ImportJob = {
      id: randomUUID(),
      userId: input.userId,
      sourceType: "url",
      payload: { url: input.url },
      options: input.options,
      status: "PENDING",
      progressPct: 0,
      warnings: [],
      errors: [],
      createdAt: now,
      updatedAt: now
    };

    await this.jobRepository.create(job);
    await this.jobQueue.enqueue(job.id);

    const queuedJob: ImportJob = {
      ...job,
      status: "QUEUED",
      updatedAt: nowIso()
    };

    await this.jobRepository.update(queuedJob);

    return queuedJob;
  }
}
