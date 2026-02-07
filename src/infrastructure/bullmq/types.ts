import type { StepCategory } from "@recipe/pipeline-contracts";

// Data stored in each BullMQ job
export interface BullMQJobData {
  userId: string;
  pipelineId: string;
  payload: unknown;
  idempotencyKey?: string;
  inputRef?: string;
  debug?: boolean;
}

// API-facing job status (mapped from BullMQ states)
export type ApiJobStatus = "queued" | "active" | "completed" | "failed" | "canceled";

// Result of querying job state from BullMQ
export interface JobStateResult {
  status: ApiJobStatus;
  progress?: {
    stepId: string;
    stepLabel: string;
    stepCategory: StepCategory;
    status: "started" | "completed";
    stepIndex: number;
    totalSteps: number;
  };
  failedReason?: string;
}
