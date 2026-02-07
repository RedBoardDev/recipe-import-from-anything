import { z } from "zod";

export const importBodySchema = z.object({
  pipelineId: z.string().trim().min(1),
  payload: z.unknown().optional(),
  inputRef: z.string().trim().min(1).optional(),
});

export type ImportBody = z.infer<typeof importBodySchema>;
