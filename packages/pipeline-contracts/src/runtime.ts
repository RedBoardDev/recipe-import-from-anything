import type { TextExtractionResult } from "@recipe/domain";
import type { FetchClient, Logger, TempInputStore } from "./io.js";
import type { LlmClient } from "./llm.js";
import type { OcrClient } from "./ocr.js";
import type { PipelineProgressReporter } from "./progress-reporter.js";

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
  ocr?: OcrClient;
  logger: Logger;
  signal: AbortSignal;
  context: PipelineExecutionContext;
}>;

export type PipelineRuntime<TInput> = Readonly<{
  execute(input: TInput, deps: PipelineDeps, reporter: PipelineProgressReporter): Promise<TextExtractionResult>;
}>;
