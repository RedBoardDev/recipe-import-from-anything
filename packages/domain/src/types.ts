export type SourceType =
  | "url"
  | "text"
  | "pdf"
  | "image"
  | "video"
  | "social"
  | "integration";

export type LlmPolicy = "never" | "fallback" | "always";

export interface ImportOptions {
  llmPolicy: LlmPolicy;
  debug: boolean;
}

export type JobStatus =
  | "PENDING"
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED";

export interface ImportWarning {
  code: string;
  message: string;
  stepId?: string;
  details?: Record<string, unknown>;
}

export interface ImportError {
  code: string;
  message: string;
  stepId?: string;
  details?: Record<string, unknown>;
}

export interface EvidenceRef {
  id: string;
  type: "html" | "jsonld" | "text" | "image" | "video" | "other";
  uri: string;
  summary?: string;
}

export interface EvidenceBundle {
  refs: EvidenceRef[];
  summary?: string;
}

export interface ConfidenceReport {
  overall: number;
  fields: Record<string, number>;
}

export interface ImportJob {
  id: string;
  userId: string;
  sourceType: SourceType;
  payload: Record<string, unknown>;
  options: ImportOptions;
  status: JobStatus;
  progressPct: number;
  currentStep?: string;
  warnings: ImportWarning[];
  errors: ImportError[];
  createdAt: string;
  updatedAt: string;
}

export interface ImportResultMetaStep {
  id: string;
  status: "SUCCEEDED" | "FAILED";
  durationMs: number;
}

export interface ImportResultMeta {
  pipelineId: string;
  steps: ImportResultMetaStep[];
  llmPolicy: LlmPolicy;
  debug: boolean;
  startedAt: string;
  endedAt: string;
}

export interface ImportResult {
  recipe: Record<string, unknown>;
  confidence: ConfidenceReport;
  evidence: EvidenceBundle;
  warnings: ImportWarning[];
  errors: ImportError[];
  meta: ImportResultMeta;
}
