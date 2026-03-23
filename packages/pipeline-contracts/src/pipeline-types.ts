import type { z } from "zod";

// This mirrors StepName from @recipe/domain intentionally (different layers)
export type StepCategory = "collecting" | "extracting" | "finalizing";

export type StepDefinition = Readonly<{
  id: string;
  label: string;
  category: StepCategory;
}>;

export type PipelineMeta<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = Readonly<{
  pipelineId: string;
  title: string;
  description?: string;
  steps: readonly StepDefinition[];
  inputSchema: TSchema;
}>;

export type PipelineInput<TSchema extends z.ZodTypeAny> = z.infer<TSchema>;
