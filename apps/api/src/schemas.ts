import { z } from "zod";

export const importOptionsSchema = z
  .object({
    llmPolicy: z.enum(["never", "fallback", "always"]).default("never"),
    debug: z.boolean().default(false)
  })
  .default({ llmPolicy: "never", debug: false });

export const importFromUrlSchema = z.object({
  url: z.string().url(),
  options: importOptionsSchema.optional()
});

export const importFromTextSchema = z.object({
  text: z.string().min(1),
  options: importOptionsSchema.optional()
});
