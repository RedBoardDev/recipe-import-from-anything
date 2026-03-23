import type { OcrClient, OcrRequest, OcrResponse } from "@recipe/pipeline-contracts";
import { z } from "zod";
import type { LoggerPort } from "../application/ports/logger.port.js";
import { consoleLogger } from "./logger.js";
import {
  computeRetryDelayMs,
  createAbortController,
  isAbortError,
  isRetryableHttpStatus,
  waitWithSignal,
} from "./mistral-shared.js";

const DEFAULT_BASE_URL = "https://api.mistral.ai";
const DEFAULT_OCR_MODEL = "mistral-ocr-latest";
const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 700;

const uploadedFileSchema = z.object({
  id: z.string().trim().min(1),
});

const ocrResponseSchema = z.object({
  model: z.string(),
  pages: z.array(
    z.object({
      index: z.number().int().min(0),
      markdown: z.string(),
    }),
  ),
  document_annotation: z.string().nullable().optional(),
  usage_info: z
    .object({
      pages_processed: z.number().int().optional(),
      doc_size_bytes: z.number().int().optional(),
    })
    .optional(),
});

const sanitizeBaseUrl = (value: string): string => value.replace(/\/+$/, "");

const resolveBaseUrl = (): string => {
  const configuredBaseUrl = process.env.MISTRAL_API_BASE_URL?.trim();
  if (configuredBaseUrl && configuredBaseUrl.length > 0) {
    return sanitizeBaseUrl(configuredBaseUrl);
  }
  return DEFAULT_BASE_URL;
};

const resolveApiKey = (): string => {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY is required to use document OCR");
  }
  return apiKey;
};

const resolveTimeoutMs = (): number => {
  const raw = process.env.MISTRAL_OCR_TIMEOUT_MS;
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return parsed;
};

const resolveRetryAttempts = (): number => {
  const raw = process.env.MISTRAL_OCR_RETRY_ATTEMPTS;
  if (!raw) return DEFAULT_RETRY_ATTEMPTS;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return DEFAULT_RETRY_ATTEMPTS;
  return Math.max(1, parsed);
};

const resolveRetryBaseDelayMs = (): number => {
  const raw = process.env.MISTRAL_OCR_RETRY_BASE_DELAY_MS;
  if (!raw) return DEFAULT_RETRY_BASE_DELAY_MS;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_RETRY_BASE_DELAY_MS;
  return parsed;
};

const resolveOcrModel = (requestedModel?: string): string => {
  if (requestedModel && requestedModel.trim().length > 0) {
    return requestedModel.trim();
  }
  const configuredModel = process.env.MISTRAL_OCR_MODEL?.trim();
  if (configuredModel && configuredModel.length > 0) {
    return configuredModel;
  }
  return DEFAULT_OCR_MODEL;
};

const shouldRetryStatus = isRetryableHttpStatus;

const formatProviderErrorBody = (value: string): string => {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return "Empty response body";
  }

  try {
    const parsedValue = JSON.parse(trimmedValue) as unknown;
    if (typeof parsedValue === "object" && parsedValue !== null) {
      const record = parsedValue as Record<string, unknown>;
      const message = typeof record.message === "string" ? record.message.trim() : "";
      const type = typeof record.type === "string" ? record.type.trim() : "";
      const code = typeof record.code === "string" ? record.code.trim() : "";

      const segments = [message, type ? `type=${type}` : "", code ? `code=${code}` : ""].filter(
        (segment) => segment.length > 0,
      );

      if (segments.length > 0) {
        return segments.join(", ");
      }
    }
  } catch {
    // Fall back to the raw body snippet when the provider does not return JSON.
  }

  return trimmedValue.slice(0, 300);
};

const createOcrRequestBody = (request: OcrRequest, fileId: string): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    model: resolveOcrModel(request.model),
    document: {
      type: "file",
      file_id: fileId,
    },
  };

  if (request.documentAnnotationSchema) {
    body.document_annotation_format = {
      type: "json_schema",
      json_schema: {
        name: "recipe_document_extraction",
        strict: true,
        schema: request.documentAnnotationSchema,
      },
    };
  }

  if (request.documentAnnotationPrompt && request.documentAnnotationPrompt.trim().length > 0) {
    body.document_annotation_prompt = request.documentAnnotationPrompt.trim();
  }

  return body;
};

const uploadFile = async (
  request: OcrRequest,
  options: Readonly<{
    baseUrl: string;
    apiKey: string;
    maxAttempts: number;
    retryBaseDelayMs: number;
    signal: AbortSignal;
    logger: LoggerPort;
  }>,
): Promise<string> => {
  const endpoint = `${options.baseUrl}/v1/files`;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      const form = new FormData();
      form.append("purpose", "ocr");
      form.append(
        "file",
        new Blob([new Uint8Array(request.document.bytes)], { type: request.document.mimeType }),
        request.document.filename,
      );

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: form,
        signal: options.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        options.logger.warn("Mistral OCR file upload failed", {
          attempt,
          maxAttempts: options.maxAttempts,
          status: response.status,
          body: body.slice(0, 1_000),
        });

        if (attempt < options.maxAttempts && shouldRetryStatus(response.status)) {
          await waitWithSignal(computeRetryDelayMs(attempt, options.retryBaseDelayMs), options.signal);
          continue;
        }

        throw new Error(`Mistral OCR file upload failed with status ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      const parsed = uploadedFileSchema.safeParse(payload);
      if (!parsed.success) {
        options.logger.warn("Invalid upload response from Mistral OCR", {
          issues: parsed.error.issues,
        });
        throw new Error("Invalid upload response from Mistral OCR");
      }

      return parsed.data.id;
    } catch (error) {
      if (options.signal.aborted) {
        throw new Error("Mistral OCR aborted");
      }

      const retryableTransportError = isAbortError(error) || error instanceof TypeError;
      if (attempt < options.maxAttempts && retryableTransportError) {
        options.logger.warn("Mistral OCR file upload retry after transport error", {
          attempt,
          maxAttempts: options.maxAttempts,
          error: error instanceof Error ? error.message : String(error),
        });
        await waitWithSignal(computeRetryDelayMs(attempt, options.retryBaseDelayMs), options.signal);
        continue;
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error("Unknown error while uploading file to Mistral OCR");
    }
  }

  throw new Error("Mistral OCR file upload failed after exhausting retries");
};

const runOcr = async (
  request: OcrRequest,
  fileId: string,
  options: Readonly<{
    baseUrl: string;
    apiKey: string;
    maxAttempts: number;
    retryBaseDelayMs: number;
    signal: AbortSignal;
    logger: LoggerPort;
  }>,
): Promise<OcrResponse> => {
  const endpoint = `${options.baseUrl}/v1/ocr`;
  const body = JSON.stringify(createOcrRequestBody(request, fileId));

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body,
        signal: options.signal,
      });

      if (!response.ok) {
        const responseBody = await response.text();
        const errorDetails = formatProviderErrorBody(responseBody);
        options.logger.warn("Mistral OCR extraction failed", {
          attempt,
          maxAttempts: options.maxAttempts,
          status: response.status,
          body: responseBody.slice(0, 1_000),
        });

        if (attempt < options.maxAttempts && shouldRetryStatus(response.status)) {
          await waitWithSignal(computeRetryDelayMs(attempt, options.retryBaseDelayMs), options.signal);
          continue;
        }

        throw new Error(`Mistral OCR extraction failed with status ${response.status}: ${errorDetails}`);
      }

      const payload = (await response.json()) as unknown;
      const parsed = ocrResponseSchema.safeParse(payload);
      if (!parsed.success) {
        options.logger.warn("Invalid OCR response from Mistral", {
          issues: parsed.error.issues,
        });
        throw new Error("Invalid OCR response from Mistral");
      }

      return {
        model: parsed.data.model,
        pages: parsed.data.pages.map((page) => ({
          index: page.index,
          markdown: page.markdown,
        })),
        ...(parsed.data.document_annotation ? { documentAnnotation: parsed.data.document_annotation } : {}),
        ...(parsed.data.usage_info
          ? {
              usage: {
                ...(parsed.data.usage_info.pages_processed !== undefined
                  ? { pagesProcessed: parsed.data.usage_info.pages_processed }
                  : {}),
                ...(parsed.data.usage_info.doc_size_bytes !== undefined
                  ? { docSizeBytes: parsed.data.usage_info.doc_size_bytes }
                  : {}),
              },
            }
          : {}),
      };
    } catch (error) {
      if (options.signal.aborted) {
        throw new Error("Mistral OCR aborted");
      }

      const retryableTransportError = isAbortError(error) || error instanceof TypeError;
      if (attempt < options.maxAttempts && retryableTransportError) {
        options.logger.warn("Mistral OCR extraction retry after transport error", {
          attempt,
          maxAttempts: options.maxAttempts,
          error: error instanceof Error ? error.message : String(error),
        });
        await waitWithSignal(computeRetryDelayMs(attempt, options.retryBaseDelayMs), options.signal);
        continue;
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error("Unknown error while running Mistral OCR");
    }
  }

  throw new Error("Mistral OCR extraction failed after exhausting retries");
};

const deleteUploadedFile = async (
  fileId: string,
  options: Readonly<{ baseUrl: string; apiKey: string; logger: LoggerPort }>,
): Promise<void> => {
  try {
    await fetch(`${options.baseUrl}/v1/files/${fileId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
      },
    });
  } catch (error) {
    options.logger.warn("Failed to cleanup uploaded Mistral OCR file", {
      fileId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export const createMistralOcrClient = (logger: LoggerPort = consoleLogger): OcrClient => ({
  extract: async (request, options) => {
    const controller = createAbortController(options?.signal);
    const timeoutMs = resolveTimeoutMs();
    const maxAttempts = resolveRetryAttempts();
    const retryBaseDelayMs = resolveRetryBaseDelayMs();
    const baseUrl = resolveBaseUrl();
    const apiKey = resolveApiKey();
    let timedOut = false;
    let uploadedFileId: string | null = null;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      uploadedFileId = await uploadFile(request, {
        baseUrl,
        apiKey,
        maxAttempts,
        retryBaseDelayMs,
        signal: controller.signal,
        logger,
      });

      return await runOcr(request, uploadedFileId, {
        baseUrl,
        apiKey,
        maxAttempts,
        retryBaseDelayMs,
        signal: controller.signal,
        logger,
      });
    } catch (error) {
      if (controller.signal.aborted && timedOut) {
        throw new Error("Mistral OCR timed out");
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error("Unknown error while calling Mistral OCR API");
    } finally {
      clearTimeout(timeoutId);
      if (uploadedFileId) {
        await deleteUploadedFile(uploadedFileId, {
          baseUrl,
          apiKey,
          logger,
        });
      }
    }
  },
});
