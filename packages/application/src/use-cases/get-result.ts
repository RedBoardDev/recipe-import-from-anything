import type { ImportResult } from "@ria/domain";
import type { ResultRepository } from "../ports/index";

export interface GetResultInput {
  jobId: string;
}

export class GetResult {
  constructor(private readonly resultRepository: ResultRepository) {}

  async execute(_input: GetResultInput): Promise<ImportResult | null> {
    throw new Error("GetResult not implemented");
  }
}
