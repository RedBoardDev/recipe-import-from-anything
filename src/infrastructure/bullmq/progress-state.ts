import { CHECKPOINT_PROGRESS, type PipelineStatus, type ProgressCheckpoint } from "@recipe/domain";
import type { StepCategory, StepDefinition } from "@recipe/pipeline-contracts";
import type { JobProgress } from "../../application/domain/job.types.js";

type ProgressLayout = Readonly<{
  collectingIndex: number;
  extractingIndex: number;
  formattingIndex: number;
  totalSteps: number;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isPipelineStatus = (value: unknown): value is PipelineStatus =>
  value === "pending" ||
  value === "collecting" ||
  value === "extracting" ||
  value === "formatting" ||
  value === "completed" ||
  value === "failed" ||
  value === "canceled";

const resolveStepIndex = (steps: readonly StepDefinition[], category: StepCategory, fallbackIndex: number): number => {
  const index = steps.findIndex((step) => step.category === category);
  if (index >= 0) {
    return index;
  }

  return Math.max(0, Math.min(fallbackIndex, steps.length - 1));
};

const resolveProgressLayout = (steps: readonly StepDefinition[]): ProgressLayout => {
  if (steps.length === 0) {
    return {
      collectingIndex: 0,
      extractingIndex: 0,
      formattingIndex: 0,
      totalSteps: 1,
    };
  }

  const finalizingIndex = steps.findIndex((step) => step.category === "finalizing");
  const totalSteps = finalizingIndex >= 0 ? steps.length : steps.length + 1;

  return {
    collectingIndex: resolveStepIndex(steps, "collecting", 0),
    extractingIndex: resolveStepIndex(steps, "extracting", Math.min(1, steps.length - 1)),
    formattingIndex: finalizingIndex >= 0 ? finalizingIndex : totalSteps - 1,
    totalSteps,
  };
};

const createSnapshot = (
  layout: ProgressLayout,
  state: Readonly<{
    percent: number;
    status: PipelineStatus;
    stepIndex: number;
    timestamp: number;
  }>,
): JobProgress => ({
  percent: state.percent,
  status: state.status,
  stepIndex: state.stepIndex,
  totalSteps: layout.totalSteps,
  timestamp: state.timestamp,
});

const withStatus = (
  layout: ProgressLayout,
  status: PipelineStatus,
  previous: JobProgress | null,
  timestamp: number,
): JobProgress => {
  const stepIndex =
    status === "collecting"
      ? layout.collectingIndex
      : status === "extracting"
        ? layout.extractingIndex
        : status === "formatting" || status === "completed"
          ? layout.formattingIndex
          : (previous?.stepIndex ?? layout.collectingIndex);

  const percent =
    status === "pending"
      ? 0
      : status === "collecting"
        ? Math.max(previous?.percent ?? 0, CHECKPOINT_PROGRESS.job_pickup)
        : status === "extracting"
          ? Math.max(previous?.percent ?? 0, CHECKPOINT_PROGRESS.ocr_started)
          : status === "formatting"
            ? Math.max(previous?.percent ?? 0, CHECKPOINT_PROGRESS.formatting_started)
            : status === "completed"
              ? CHECKPOINT_PROGRESS.completed
              : (previous?.percent ?? 0);

  return createSnapshot(layout, {
    percent,
    status,
    stepIndex,
    timestamp,
  });
};

const withCheckpoint = (
  layout: ProgressLayout,
  checkpoint: ProgressCheckpoint,
  previous: JobProgress | null,
  timestamp: number,
): JobProgress => {
  if (checkpoint === "completed") {
    return createSnapshot(layout, {
      percent: CHECKPOINT_PROGRESS.completed,
      status: "completed",
      stepIndex: previous?.stepIndex ?? layout.formattingIndex,
      timestamp,
    });
  }

  if (checkpoint === "job_pickup" || checkpoint === "images_loaded") {
    return createSnapshot(layout, {
      percent: CHECKPOINT_PROGRESS[checkpoint],
      status: "collecting",
      stepIndex: layout.collectingIndex,
      timestamp,
    });
  }

  if (
    checkpoint === "ocr_started" ||
    checkpoint === "ocr_progress_1" ||
    checkpoint === "ocr_progress_2" ||
    checkpoint === "ocr_progress_3"
  ) {
    return createSnapshot(layout, {
      percent: CHECKPOINT_PROGRESS[checkpoint],
      status: "extracting",
      stepIndex: layout.extractingIndex,
      timestamp,
    });
  }

  return createSnapshot(layout, {
    percent: CHECKPOINT_PROGRESS[checkpoint],
    status: "formatting",
    stepIndex: layout.formattingIndex,
    timestamp,
  });
};

export const createJobProgressTracker = (steps: readonly StepDefinition[]) => {
  const layout = resolveProgressLayout(steps);
  let current: JobProgress | null = null;

  return {
    setStatus(status: PipelineStatus, timestamp = Date.now()): JobProgress {
      current = withStatus(layout, status, current, timestamp);
      return current;
    },
    checkpoint(checkpoint: ProgressCheckpoint, timestamp = Date.now()): JobProgress {
      current = withCheckpoint(layout, checkpoint, current, timestamp);
      return current;
    },
    current(): JobProgress | null {
      return current;
    },
  };
};

export const parseStoredJobProgress = (value: unknown): JobProgress | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  if (
    typeof value.percent !== "number" ||
    !isPipelineStatus(value.status) ||
    typeof value.stepIndex !== "number" ||
    typeof value.totalSteps !== "number" ||
    typeof value.timestamp !== "number"
  ) {
    return undefined;
  }

  return {
    percent: value.percent,
    status: value.status,
    stepIndex: value.stepIndex,
    totalSteps: value.totalSteps,
    timestamp: value.timestamp,
  };
};
