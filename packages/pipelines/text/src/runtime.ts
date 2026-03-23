import type { PipelineInput, PipelineRuntime } from "@recipe/pipeline-contracts";
import type { meta } from "./meta.js";

type TextInput = PipelineInput<typeof meta.inputSchema>;

export const runtime: PipelineRuntime<TextInput> = {
  execute: async (input, _deps, reporter) => {
    reporter.checkpoint("job_pickup");
    reporter.setStatus("extracting");

    return {
      rawText: input.text,
      metadata: {
        sourceType: "text",
        sourceValue: input.text.substring(0, 100),
        extractionConfidence: 1,
      },
    };
  },
};
