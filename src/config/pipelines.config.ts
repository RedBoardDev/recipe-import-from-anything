import type { PipelineConfig } from "../core/registry/types.js";

export const pipelineConfigs: readonly PipelineConfig[] = [
  {
    pipelineId: "text",
    metaEntry: "@recipe/pipeline-text/meta",
    runtimeEntry: "@recipe/pipeline-text/runtime",
  },
  {
    pipelineId: "url",
    metaEntry: "@recipe/pipeline-url/meta",
    runtimeEntry: "@recipe/pipeline-url/runtime",
    network: {
      mode: "allowlist",
      allowedHosts: ["*"],
    },
  },
];
