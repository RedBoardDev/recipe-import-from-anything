import type { Logger } from "./io.js";
import type { LlmClient } from "./llm.js";

export type FormatterDeps = Readonly<{
  llm: LlmClient;
  logger: Logger;
  signal: AbortSignal;
  context: Readonly<{
    jobId: string;
    pipelineId: string;
    sourceType: string;
    sourceValue: string;
  }>;
}>;
