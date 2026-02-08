import { z } from "zod";

export type LlmMessageRole = "system" | "user" | "assistant";

export type LlmMessage = Readonly<{
  role: LlmMessageRole;
  content: string;
}>;

const jsonSchemaResponseFormatSchema = z.object({
  name: z.string().min(1),
  strict: z.boolean().optional(),
  schema: z.unknown(),
});

export const LlmResponseFormatSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text") }),
  z.object({ type: z.literal("json_object") }),
  z.object({
    type: z.literal("json_schema"),
    json_schema: jsonSchemaResponseFormatSchema,
  }),
  z.object({
    type: z.literal("raw"),
    value: z.record(z.unknown()),
  }),
]);

export type LlmResponseFormat = Readonly<z.infer<typeof LlmResponseFormatSchema>>;

export type LlmCompletionRequest = Readonly<{
  messages: readonly LlmMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  // Provider-specific response format payloads vary and evolve over time.
  // We keep this field flexible to avoid coupling pipeline contracts to one vendor shape.
  responseFormat?: LlmResponseFormat;
}>;

export type LlmCompletionResponse = Readonly<{
  content: string;
}>;

export type LlmClient = Readonly<{
  complete(request: LlmCompletionRequest, options?: Readonly<{ signal?: AbortSignal }>): Promise<LlmCompletionResponse>;
}>;
