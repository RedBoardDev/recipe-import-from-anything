export const QUEUE_NAME = "recipe-import-jobs";
export const CANCELLATION_KEY_PREFIX = "recipe-import:cancel";
export const CANCELLATION_TTL_MS = 60 * 60_000;

export const IDEMPOTENCY_KEY_PREFIX = "recipe-import:idempotency";
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60_000;

export const PIPELINE_STEPS = ["collecting", "extracting"] as const;
export type PipelineStepName = (typeof PIPELINE_STEPS)[number];

export const DEFAULT_TOTAL_STEPS = PIPELINE_STEPS.length;
