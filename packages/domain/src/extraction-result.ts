import type { Warning } from "./value-objects/warning.js";

export type TextExtractionResult = Readonly<{
  rawText: string;
  artifactRefs?: readonly string[];
  metadata: Readonly<{
    sourceType: string;
    sourceValue: string;
    extractionConfidence: number;
  }>;
  warnings?: readonly Warning[];
}>;
