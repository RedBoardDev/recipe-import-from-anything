import type {
  LlmClient,
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmResponseFormat,
} from "@recipe/pipeline-contracts";
import { LlmResponseFormatSchema } from "@recipe/pipeline-contracts";
import { z } from "zod";
import type { LoggerPort } from "../application/ports.js";
import { consoleLogger } from "./logger.js";

const DEFAULT_MODEL = "mistral-small-latest";
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_BASE_URL = "https://api.mistral.ai";
const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 500;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

const contentPartSchema = z.object({
  type: z.string().optional(),
  text: z.string().optional(),
});

const completionResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.union([z.string(), z.array(contentPartSchema)]),
        }),
      }),
    )
    .min(1),
});

type Result<T, E> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

type ResponseFormatValidationError = Readonly<{
  type: "invalid-response-format";
  issues: readonly z.ZodIssue[];
}>;

type CompletionResponseError =
  | Readonly<{
      type: "invalid-response";
      issues: readonly z.ZodIssue[];
    }>
  | Readonly<{
      type: "empty-content";
    }>;

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

const sanitizeBaseUrl = (value: string): string => value.replace(/\/+$/, "");

const resolveEndpoint = (): string => {
  const configuredBaseUrl = process.env.MISTRAL_API_BASE_URL?.trim();
  const baseUrl = configuredBaseUrl && configuredBaseUrl.length > 0 ? configuredBaseUrl : DEFAULT_BASE_URL;
  return `${sanitizeBaseUrl(baseUrl)}/v1/chat/completions`;
};

const resolveApiKey = (): string => {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY is required to use the text LLM pipeline");
  }
  return apiKey;
};

const resolveTimeoutMs = (): number => {
  const raw = process.env.MISTRAL_TIMEOUT_MS;
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? DEFAULT_TIMEOUT_MS : parsed;
};

const resolveModel = (requestModel?: string): string => {
  if (requestModel && requestModel.trim().length > 0) {
    return requestModel.trim();
  }
  const configuredModel = process.env.MISTRAL_MODEL?.trim();
  if (configuredModel && configuredModel.length > 0) {
    return configuredModel;
  }
  return DEFAULT_MODEL;
};

const resolveRetryAttempts = (): number => {
  const raw = process.env.MISTRAL_RETRY_ATTEMPTS;
  if (!raw) return DEFAULT_RETRY_ATTEMPTS;

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return DEFAULT_RETRY_ATTEMPTS;

  return Math.max(1, parsed);
};

const resolveRetryBaseDelayMs = (): number => {
  const raw = process.env.MISTRAL_RETRY_BASE_DELAY_MS;
  if (!raw) return DEFAULT_RETRY_BASE_DELAY_MS;

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_RETRY_BASE_DELAY_MS;

  return parsed;
};

const normalizeContent = (content: string | Array<{ type?: string; text?: string }>): string => {
  if (typeof content === "string") {
    return content;
  }

  return content
    .map((part) => part.text ?? "")
    .join("")
    .trim();
};

const resolveResponseFormatPayload = (format: LlmResponseFormat): Record<string, unknown> => {
  if (format.type === "raw") {
    return format.value;
  }
  return format;
};

const parseResponseFormat = (
  responseFormat: LlmCompletionRequest["responseFormat"],
): Result<LlmResponseFormat | undefined, ResponseFormatValidationError> => {
  if (responseFormat === undefined) {
    return ok(undefined);
  }

  const parsed = LlmResponseFormatSchema.safeParse(responseFormat);
  if (!parsed.success) {
    return err({ type: "invalid-response-format", issues: parsed.error.issues });
  }

  return ok(parsed.data);
};

const createAbortController = (externalSignal?: AbortSignal): AbortController => {
  const controller = new AbortController();

  if (!externalSignal) {
    return controller;
  }

  if (externalSignal.aborted) {
    controller.abort();
    return controller;
  }

  externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  return controller;
};

const buildRequestBody = (
  request: LlmCompletionRequest,
): Result<Record<string, unknown>, ResponseFormatValidationError> => {
  const responseFormatResult = parseResponseFormat(request.responseFormat);
  if (!responseFormatResult.ok) {
    return responseFormatResult;
  }

  const responseFormatPayload = responseFormatResult.value
    ? resolveResponseFormatPayload(responseFormatResult.value)
    : undefined;

  return ok({
    model: resolveModel(request.model),
    messages: request.messages,
    temperature: request.temperature ?? 0,
    ...(typeof request.maxTokens === "number" ? { max_tokens: request.maxTokens } : {}),
    ...(responseFormatPayload ? { response_format: responseFormatPayload } : {}),
  });
};

const parseCompletionResponse = (payload: unknown): Result<LlmCompletionResponse, CompletionResponseError> => {
  const parsed = completionResponseSchema.safeParse(payload);
  if (!parsed.success) {
    return err({ type: "invalid-response", issues: parsed.error.issues });
  }

  const content = normalizeContent(parsed.data.choices[0].message.content);
  if (content.length === 0) {
    return err({ type: "empty-content" });
  }

  return ok({ content });
};

const isAbortError = (error: unknown): boolean => error instanceof Error && error.name === "AbortError";

const computeRetryDelayMs = (attempt: number, baseDelayMs: number): number => {
  const backoff = baseDelayMs * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(baseDelayMs / 2)));
  return backoff + jitter;
};

const waitWithSignal = async (delayMs: number, signal: AbortSignal): Promise<void> => {
  if (delayMs <= 0) return;
  if (signal.aborted) {
    throw new Error("Aborted before retry delay elapsed");
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);

    const onAbort = (): void => {
      clearTimeout(timeoutId);
      signal.removeEventListener("abort", onAbort);
      reject(new Error("Aborted during retry delay"));
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
};

const isRetryableHttpStatus = (status: number): boolean => RETRYABLE_STATUS_CODES.has(status);

export const createMistralClient = (logger: LoggerPort = consoleLogger): LlmClient => ({
  complete: async (request, options) => {
    const endpoint = resolveEndpoint();
    const apiKey = resolveApiKey();
    const timeoutMs = resolveTimeoutMs();
    const maxAttempts = resolveRetryAttempts();
    const retryBaseDelayMs = resolveRetryBaseDelayMs();
    const controller = createAbortController(options?.signal);
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const bodyResult = buildRequestBody(request);

    try {
      if (!bodyResult.ok) {
        logger.warn("Invalid response format provided to Mistral client", {
          issues: bodyResult.error.issues,
        });
        throw new Error("Invalid response format provided to Mistral client");
      }

      const requestBody = JSON.stringify(bodyResult.value);
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: requestBody,
            signal: controller.signal,
          });

          if (!response.ok) {
            const responseText = await response.text();
            logger.warn("Mistral completion failed", {
              attempt,
              maxAttempts,
              status: response.status,
              body: responseText.slice(0, 1_000),
            });

            if (attempt < maxAttempts && isRetryableHttpStatus(response.status)) {
              await waitWithSignal(computeRetryDelayMs(attempt, retryBaseDelayMs), controller.signal);
              continue;
            }

            throw new Error(`Mistral completion failed with status ${response.status}`);
          }

          const payload = (await response.json()) as unknown;
          const completionResult = parseCompletionResponse(payload);
          if (!completionResult.ok) {
            logger.warn("Invalid response received from Mistral completion API", {
              errorType: completionResult.error.type,
              issues: completionResult.error.type === "invalid-response" ? completionResult.error.issues : undefined,
            });
            throw new Error("Invalid response received from Mistral completion API");
          }

          return completionResult.value;
        } catch (error) {
          if (controller.signal.aborted) {
            if (timedOut) {
              throw new Error("Mistral completion timed out");
            }
            throw new Error("Mistral completion aborted");
          }

          const retryableTransportError = isAbortError(error) || error instanceof TypeError;
          if (attempt < maxAttempts && retryableTransportError) {
            logger.warn("Mistral completion retrying after transport error", {
              attempt,
              maxAttempts,
              error: error instanceof Error ? error.message : String(error),
            });
            await waitWithSignal(computeRetryDelayMs(attempt, retryBaseDelayMs), controller.signal);
            continue;
          }

          if (error instanceof Error) {
            throw error;
          }
          throw new Error("Unknown error while calling Mistral completion API");
        }
      }

      throw new Error("Mistral completion failed after exhausting retries");
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Unknown error while calling Mistral completion API");
    } finally {
      clearTimeout(timeoutId);
    }
  },
});
