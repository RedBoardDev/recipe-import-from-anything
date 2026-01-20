import type { ImportError, ImportJob, ImportResult } from "@ria/domain";
import { StepExecutionError } from "../workflow/index";
import type {
  JobRepository,
  PipelineRunner,
  ResultRepository
} from "../ports/index";

export interface ExecuteJobInput {
  jobId: string;
}

const nowIso = (): string => new Date().toISOString();

const toImportError = (error: unknown): ImportError => {
  if (error instanceof StepExecutionError) {
    return {
      code: "STEP_FAILED",
      message: error.message,
      stepId: error.stepId
    };
  }

  if (error instanceof Error) {
    return {
      code: "EXECUTE_JOB_FAILED",
      message: error.message
    };
  }

  return {
    code: "EXECUTE_JOB_FAILED",
    message: "Unknown error"
  };
};

const withStatus = (
  job: ImportJob,
  status: ImportJob["status"],
  updates: Partial<ImportJob> = {}
): ImportJob => ({
  ...job,
  status,
  updatedAt: nowIso(),
  ...updates
});

export class ExecuteJob {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly resultRepository: ResultRepository,
    private readonly pipelineRunner: PipelineRunner
  ) {}

  async execute({ jobId }: ExecuteJobInput): Promise<ImportResult> {
    const job = await this.jobRepository.getById(jobId);

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const runningJob = withStatus(job, "RUNNING", {
      progressPct: 0,
      currentStep: undefined
    });

    await this.jobRepository.update(runningJob);

    try {
      const result = await this.pipelineRunner.run(runningJob);
      await this.resultRepository.save(jobId, result);

      const latestJob = (await this.jobRepository.getById(jobId)) ?? runningJob;
      const succeededJob = withStatus(latestJob, "SUCCEEDED", {
        progressPct: 100,
        currentStep: undefined
      });

      await this.jobRepository.update(succeededJob);

      return result;
    } catch (error) {
      const failure = toImportError(error);
      const latestJob = (await this.jobRepository.getById(jobId)) ?? runningJob;
      const failedJob = withStatus(latestJob, "FAILED", {
        errors: [...latestJob.errors, failure],
        currentStep: undefined
      });

      await this.jobRepository.update(failedJob);
      throw error;
    }
  }
}
