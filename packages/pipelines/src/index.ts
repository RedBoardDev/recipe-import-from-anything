import type { ImportJob, ImportResult, SourceType } from "@ria/domain";
import type { ArtifactStore, Logger } from "@ria/application";

export interface PipelineContext {
  logger: Logger;
  artifactStore: ArtifactStore;
}

export interface Pipeline {
  id: string;
  sourceType: SourceType;
  run(job: ImportJob, ctx: PipelineContext): Promise<ImportResult>;
}

export interface PipelineRegistry {
  get(sourceType: SourceType): Pipeline;
}

export { NoopPipeline } from "./noop-pipeline";
export { StaticPipelineRegistry } from "./registry";
export { RegistryPipelineRunner } from "./pipeline-runner";
