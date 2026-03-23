import { ValueObject } from "@recipe/domain-driven-design";
import type { StepName } from "../types.js";

export const WARNING_CODES = {
  PARTIAL_EXTRACTION: "PARTIAL_EXTRACTION",
  MISSING_FIELDS: "MISSING_FIELDS",
  LOW_CONFIDENCE: "LOW_CONFIDENCE",
  ARTIFACT_NOT_STORED: "ARTIFACT_NOT_STORED",
  OCR_FAILED: "OCR_FAILED",
  FALLBACK_FAILED: "FALLBACK_FAILED",
  FUSION_FAILED: "FUSION_FAILED",
  FINALIZATION_FAILED: "FINALIZATION_FAILED",
  FINALIZATION_FALLBACK: "FINALIZATION_FALLBACK",
} as const;

export type WarningCode = (typeof WARNING_CODES)[keyof typeof WARNING_CODES];

interface WarningProps {
  code: WarningCode;
  message: string;
  stepName?: StepName;
}

export class Warning extends ValueObject<WarningProps> {
  constructor(code: WarningCode, message: string, stepName?: StepName) {
    super({ code, message, stepName });
  }

  get code(): WarningCode {
    return this.props.code;
  }

  get message(): string {
    return this.props.message;
  }

  get stepName(): StepName | undefined {
    return this.props.stepName;
  }
}
