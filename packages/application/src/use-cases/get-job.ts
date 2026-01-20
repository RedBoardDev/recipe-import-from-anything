import type { ImportJob } from "@ria/domain";
import type { JobRepository } from "../ports/index";

export interface GetJobInput {
  jobId: string;
}

export class GetJob {
  constructor(private readonly jobRepository: JobRepository) {}

  async execute(_input: GetJobInput): Promise<ImportJob | null> {
    throw new Error("GetJob not implemented");
  }
}
