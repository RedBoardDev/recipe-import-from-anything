import type { ImportError, ImportJob, ImportResult } from "@ria/domain";
import type { JobRepository, StepRunRepository } from "../ports/index";
import { StepExecutionError } from "./step-error";
import type { StepContext, StepRunOutput, WorkflowDefinition, WorkflowRunner } from "./types";

const nowIso = (): string => new Date().toISOString();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isStepRunOutput = (value: unknown): value is StepRunOutput<unknown> =>
  isRecord(value) && "output" in value;

const normalizeStepOutput = <T>(value: T | StepRunOutput<T>): StepRunOutput<T> =>
  isStepRunOutput(value) ? value : { output: value };

const toStepError = (stepId: string, error: unknown): StepExecutionError => {
  if (error instanceof Error) {
    return new StepExecutionError(stepId, error.message, error);
  }

  return new StepExecutionError(stepId, "Unknown step error", error);
};

const toImportError = (stepError: StepExecutionError): ImportError => ({
  code: "STEP_FAILED",
  message: stepError.message,
  stepId: stepError.stepId
});

const toErrorMeta = (error: unknown): Record<string, unknown> | undefined => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  if (isRecord(error)) {
    return error;
  }

  return undefined;
};

const updateJobProgress = (
  job: ImportJob,
  stepId: string,
  progressPct: number
): ImportJob => ({
  ...job,
  progressPct,
  currentStep: stepId,
  updatedAt: nowIso()
});

const clearJobProgress = (job: ImportJob): ImportJob => ({
  ...job,
  progressPct: 100,
  currentStep: undefined,
  updatedAt: nowIso()
});

export class LinearWorkflowRunner implements WorkflowRunner {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly stepRunRepository: StepRunRepository
  ) {}

  async run<I, O>(
    workflow: WorkflowDefinition<I, O>,
    ctx: StepContext
  ): Promise<ImportResult> {
    const steps = workflow.steps;
    let currentOutput: unknown = workflow.initialInput;
    let job = ctx.job;

    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      const progressPct = Math.round((index / steps.length) * 100);
      job = updateJobProgress(job, step.id, progressPct);
      ctx.job = job;

      await this.jobRepository.update(job);

      const runId = await this.stepRunRepository.startRun(job.id, step.id);

      try {
        const stepResult = await step.run(currentOutput as never, ctx);
        const normalized = normalizeStepOutput(stepResult as StepRunOutput<unknown>);

        await this.stepRunRepository.finishRun(runId, "SUCCEEDED", {
          meta: normalized.meta,
          outputRef: normalized.outputRef
        });

        currentOutput = normalized.output;
      } catch (error) {
        const stepError = toStepError(step.id, error);
        const importError = toImportError(stepError);

        await this.stepRunRepository.failRun(runId, importError, {
          meta: toErrorMeta(error)
        });

        throw stepError;
      }
    }

    const finalJob = clearJobProgress(job);
    await this.jobRepository.update(finalJob);
    ctx.job = finalJob;

    const stepRuns = await this.stepRunRepository.listByJobId(job.id);

    return workflow.finalize(currentOutput as O, ctx, stepRuns);
  }
}
