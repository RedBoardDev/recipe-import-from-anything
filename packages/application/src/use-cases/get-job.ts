import type { ImportJob } from "@ria/domain";
import type { JobRepository } from "../ports/index";

export interface GetJobInput {
  jobId: string;
}

export class GetJob {
  constructor(private readonly jobRepository: JobRepository) {}

  async execute(input: GetJobInput): Promise<ImportJob | null> {
    return this.jobRepository.getById(input.jobId);
  }
}
