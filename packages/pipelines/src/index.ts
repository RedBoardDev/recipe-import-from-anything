import type { ImportJob, ImportResult, SourceType } from "@ria/domain";
import type { ArtifactStore, Logger, WorkflowDefinition } from "@ria/application";

export interface PipelineContext {
  logger: Logger;
  artifactStore: ArtifactStore;
}

export interface Pipeline<O = unknown> {
  id: string;
  sourceType: SourceType;
  createWorkflow(job: ImportJob): WorkflowDefinition<ImportJob, O>;
}

export interface PipelineRegistry {
  get(sourceType: SourceType): Pipeline;
}

export { NoopPipeline } from "./noop-pipeline";
export { StaticPipelineRegistry } from "./registry";
export { RegistryPipelineRunner } from "./pipeline-runner";
