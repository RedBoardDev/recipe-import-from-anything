import type { IdempotencyKey, PipelineStatus, UserId } from "@recipe/domain";
import type { PipelineId } from "../../config/pipelines.config.js";

export type { PipelineId };

export interface JobData {
  userId: UserId;
  pipelineId: PipelineId;
  payload: unknown;
  idempotencyKey?: IdempotencyKey;
  inputRef?: string;
  debug?: boolean;
}

export interface JobProgress {
  percent: number;
  status: PipelineStatus;
  stepIndex: number;
  totalSteps: number;
  timestamp: number;
}

export type JobStatus = "queued" | "active" | "completed" | "failed" | "canceled";

export interface JobState {
  status: JobStatus;
  progress?: JobProgress;
  failedReason?: string;
}
