import type { ImportJob, ImportOptions } from "@ria/domain";
import type { JobQueue, JobRepository } from "../ports/index";

export interface CreateJobFromTextInput {
  userId: string;
  text: string;
  options: ImportOptions;
}

export class CreateJobFromText {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly jobQueue: JobQueue
  ) {}

  async execute(_input: CreateJobFromTextInput): Promise<ImportJob> {
    throw new Error("CreateJobFromText not implemented");
  }
}
