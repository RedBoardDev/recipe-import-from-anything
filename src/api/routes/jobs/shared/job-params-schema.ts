import { z } from "zod";

export const jobParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export type JobParams = z.infer<typeof jobParamsSchema>;
