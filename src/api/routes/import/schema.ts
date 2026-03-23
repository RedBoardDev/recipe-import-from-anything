import { z } from "zod";
import { pipelineConfigs } from "../../../config/pipelines.config.js";

const pipelineIds = pipelineConfigs.map((c) => c.pipelineId) as [string, ...string[]];

export const importBodySchema = z.object({
  pipelineId: z.enum(pipelineIds),
  payload: z.unknown().optional(),
  inputRef: z.string().trim().min(1).optional(),
});

export type ImportBody = z.infer<typeof importBodySchema>;
