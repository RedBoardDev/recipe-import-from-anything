import type { ImportJob, ImportResult } from "@ria/domain";
import type { PipelineContext, PipelineRegistry } from "./index";
import type { PipelineRunner, WorkflowRunner } from "@ria/application";

export class RegistryPipelineRunner implements PipelineRunner {
  constructor(
    private readonly registry: PipelineRegistry,
    private readonly context: PipelineContext,
    private readonly workflowRunner: WorkflowRunner
  ) {}

  async run(job: ImportJob): Promise<ImportResult> {
    const pipeline = this.registry.get(job.sourceType);
    const workflow = pipeline.createWorkflow(job);
    return this.workflowRunner.run(workflow, { ...this.context, job });
  }
}
