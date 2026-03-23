/**
 * Model configuration
 * Values can be overridden via environment variables
 */

/**
 * Default LLM model for text completion and finalization
 */
export const LLM_MODEL = process.env.LLM_MODEL || "mistral-large-latest";

/**
 * OCR model for image processing
 */
export const OCR_MODEL = process.env.OCR_MODEL || "mistral-ocr-latest";

/**
 * Whether to use fallback models on failure
 */
export const ENABLE_FALLBACK = process.env.ENABLE_FALLBACK !== "false";

/**
 * Maximum number of retries for LLM calls
 */
export const LLM_MAX_RETRIES = Number.parseInt(process.env.LLM_MAX_RETRIES || "3", 10);

/**
 * Timeout for LLM calls in milliseconds
 */
export const LLM_TIMEOUT_MS = Number.parseInt(process.env.LLM_TIMEOUT_MS || "30000", 10);
