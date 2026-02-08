import type { ImportResult } from "@recipe/domain";
import type { FetchClient, Logger, TempInputStore } from "./io.js";
import type { LlmClient } from "./llm.js";
import type { PipelineReporter } from "./reporter.js";

export type PipelineExecutionContext = Readonly<{
  jobId: string;
  pipelineId: string;
  debug: boolean;
  inputRef?: string;
}>;

export type PipelineDeps = Readonly<{
  fetch: FetchClient;
  inputs: TempInputStore;
  llm: LlmClient;
  logger: Logger;
  signal: AbortSignal;
  context: PipelineExecutionContext;
}>;

export type PipelineRuntime<TInput> = Readonly<{
  execute(input: TInput, deps: PipelineDeps, reporter: PipelineReporter): Promise<ImportResult>;
}>;
