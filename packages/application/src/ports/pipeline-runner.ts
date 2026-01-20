import type { ImportJob, ImportResult } from "@ria/domain";

export interface PipelineRunner {
  run(job: ImportJob): Promise<ImportResult>;
}
