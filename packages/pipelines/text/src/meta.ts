import type { PipelineMeta } from "@recipe/pipeline-contracts";
import { z } from "zod";

export const textInputSchema = z.object({
  text: z.string().trim().min(1, "Text input cannot be empty"),
});

export const meta: PipelineMeta<typeof textInputSchema> = {
  pipelineId: "text",
  title: "Text Import",
  description: "Extract a recipe from raw text (copy-paste from a website, book, etc.).",
  steps: [{ id: "extracting", label: "Reading text", category: "extracting" }],
  inputSchema: textInputSchema,
};
