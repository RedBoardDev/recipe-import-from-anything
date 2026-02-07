import type { ErrorCode, StepName, WarningCode } from "./types.js";

export class DomainError {
  public readonly code: ErrorCode;
  public readonly message: string;
  public readonly stepName?: StepName;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, stepName?: StepName, details?: Record<string, unknown>) {
    this.code = code;
    this.message = message;
    this.stepName = stepName;
    this.details = details;
  }
}

export class Warning {
  public readonly code: WarningCode;
  public readonly message: string;
  public readonly stepName?: StepName;

  constructor(code: WarningCode, message: string, stepName?: StepName) {
    this.code = code;
    this.message = message;
    this.stepName = stepName;
  }
}
