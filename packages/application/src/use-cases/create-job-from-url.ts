import type { ImportJob, ImportOptions } from "@ria/domain";
import type { JobQueue, JobRepository } from "../ports/index";

export interface CreateJobFromUrlInput {
  userId: string;
  url: string;
  options: ImportOptions;
}

export class CreateJobFromUrl {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly jobQueue: JobQueue
  ) {}

  async execute(_input: CreateJobFromUrlInput): Promise<ImportJob> {
    throw new Error("CreateJobFromUrl not implemented");
  }
}
