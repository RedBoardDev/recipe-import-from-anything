import type { ImportResult } from "@ria/domain";
import type { JobRepository, ResultRepository, StepRunRepository } from "../ports/index";

export interface ExecuteJobInput {
  jobId: string;
}

export class ExecuteJob {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly resultRepository: ResultRepository,
    private readonly stepRunRepository: StepRunRepository
  ) {}

  async execute(_input: ExecuteJobInput): Promise<ImportResult> {
    throw new Error("ExecuteJob not implemented");
  }
}
