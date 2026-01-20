import type { ImportResult } from "@ria/domain";
import type { ResultRepository } from "../ports/index";

export interface GetResultInput {
  jobId: string;
}

export class GetResult {
  constructor(private readonly resultRepository: ResultRepository) {}

  async execute(input: GetResultInput): Promise<ImportResult | null> {
    return this.resultRepository.getByJobId(input.jobId);
  }
}
