import type { PipelineStatus, ProgressCheckpoint } from "@recipe/domain";

export type PipelineProgressReporter = Readonly<{
  checkpoint(checkpoint: ProgressCheckpoint): void;
  setStatus(status: PipelineStatus): void;
  log(message: string): void;
}>;
