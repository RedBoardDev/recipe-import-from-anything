import type { SourceType } from "@ria/domain";
import type { Pipeline, PipelineRegistry } from "./index";

export class StaticPipelineRegistry implements PipelineRegistry {
  private readonly pipelines: Map<SourceType, Pipeline>;

  constructor(pipelines: Pipeline[]) {
    this.pipelines = new Map(
      pipelines.map((pipeline) => [pipeline.sourceType, pipeline])
    );
  }

  get(sourceType: SourceType): Pipeline {
    const pipeline = this.pipelines.get(sourceType);
    if (!pipeline) {
      throw new Error(`No pipeline registered for source type: ${sourceType}`);
    }

    return pipeline;
  }
}
