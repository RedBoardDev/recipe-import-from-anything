import type { ImportJob, ImportResult } from "@ria/domain";
import type { PipelineContext, PipelineRegistry } from "./index";
import type { PipelineRunner } from "@ria/application";

export class RegistryPipelineRunner implements PipelineRunner {
  constructor(
    private readonly registry: PipelineRegistry,
    private readonly context: PipelineContext
  ) {}

  async run(job: ImportJob): Promise<ImportResult> {
    const pipeline = this.registry.get(job.sourceType);
    return pipeline.run(job, this.context);
  }
}
