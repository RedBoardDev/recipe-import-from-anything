import type { PipelineConfig } from "../core/registry/types.js";

export const pipelineConfigs: readonly PipelineConfig[] = [
  {
    pipelineId: "images",
    metaEntry: "@recipe/pipeline-images/meta",
    runtimeEntry: "@recipe/pipeline-images/runtime",
  },
  {
    pipelineId: "text",
    metaEntry: "@recipe/pipeline-text/meta",
    runtimeEntry: "@recipe/pipeline-text/runtime",
  },
];

export type PipelineId = (typeof pipelineConfigs)[number]["pipelineId"];
