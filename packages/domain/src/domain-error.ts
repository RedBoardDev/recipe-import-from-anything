import type { StepName } from "./types.js";

export const DOMAIN_ERROR_CODES = {
  JOB_NOT_FOUND: "JOB_NOT_FOUND",
  RESULT_NOT_FOUND: "RESULT_NOT_FOUND",
  JOB_NOT_SUCCEEDED: "JOB_NOT_SUCCEEDED",
  JOB_NOT_CANCELABLE: "JOB_NOT_CANCELABLE",
  INVALID_IDEMPOTENCY_KEY: "INVALID_IDEMPOTENCY_KEY",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_INPUT: "INVALID_INPUT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof DOMAIN_ERROR_CODES)[keyof typeof DOMAIN_ERROR_CODES];

export class DomainError extends Error {
  public readonly code: ErrorCode;
  public readonly stepName?: StepName;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    stepName?: StepName,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.stepName = stepName;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
