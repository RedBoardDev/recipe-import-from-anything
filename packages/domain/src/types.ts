// This mirrors StepCategory from pipeline-contracts intentionally (different layers)
export type StepName = "collecting" | "extracting" | "finalizing";

export type EvidenceBundle = Readonly<{
  artifactRefs: readonly string[];
  debug?: {
    rawText: string;
    extractionConfidence: number;
    recipeConfidence: number;
    sourceType: string;
  };
}>;

export type PipelineStatus =
  | "pending"
  | "collecting"
  | "extracting"
  | "formatting"
  | "completed"
  | "failed"
  | "canceled";

export type ProgressCheckpoint =
  | "job_pickup"
  | "images_loaded"
  | "ocr_started"
  | "ocr_progress_1"
  | "ocr_progress_2"
  | "ocr_progress_3"
  | "formatting_started"
  | "completed";

export const CHECKPOINT_PROGRESS: Record<ProgressCheckpoint, number> = {
  job_pickup: 5,
  images_loaded: 15,
  ocr_started: 20,
  ocr_progress_1: 40,
  ocr_progress_2: 60,
  ocr_progress_3: 80,
  formatting_started: 90,
  completed: 100,
} as const;
