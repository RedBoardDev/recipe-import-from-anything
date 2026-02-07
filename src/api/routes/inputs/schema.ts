import { z } from "zod";

export const inputBodySchema = z
  .instanceof(Buffer)
  .refine((payload) => payload.length > 0, { message: "Missing binary payload" });

export type InputBody = z.infer<typeof inputBodySchema>;
