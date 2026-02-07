import type { Warning } from "@recipe/domain";

export type PipelineReporter = Readonly<{
  stepStarted(stepId: string): Promise<void>;
  stepCompleted(stepId: string): Promise<void>;
  log(message: string): void;
  addWarning(warning: Warning): void;
}>;
