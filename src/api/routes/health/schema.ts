import { z } from "zod";

export const healthCheckSchema = z.object({
  api: z.literal("ok"),
  redis: z.enum(["ok", "error"]),
  queue: z.enum(["ok", "error"]),
  timestamp: z.string(),
});

export type HealthCheck = z.infer<typeof healthCheckSchema>;
