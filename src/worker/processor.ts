import { JobId } from "@recipe/domain";
import type { PipelineDeps, PipelineReporter } from "@recipe/pipeline-contracts";
import { type Job as BullMQJob, Worker as BullMQWorker, UnrecoverableError, type WorkerOptions } from "bullmq";
import { PipelineRegistry } from "../core/registry/pipeline-registry.js";
import {
  getLockDurationMs,
  getMaxStalledCount,
  getRateLimiterConfig,
  getRedisConnectionOptions,
  getRemoveOnCompleteCount,
  getRemoveOnFailCount,
  getStalledIntervalMs,
} from "../infrastructure/bullmq/config.js";
import { BullMQQueue } from "../infrastructure/bullmq/queue.js";
import type { BullMQJobData } from "../infrastructure/bullmq/types.js";
import { createFetchClient } from "../infrastructure/fetch.js";
import { consoleLogger } from "../infrastructure/logger.js";
import { createMistralClient } from "../infrastructure/mistral-client.js";
import { tempInputStore } from "../infrastructure/temp-input-store.js";

interface ProcessorConfig {
  maxConcurrentJobs?: number;
  debug?: boolean;
}

const CANCELLATION_POLL_INTERVAL_MS = 250;

class CancellationRequestedError extends Error {
  constructor(message = "Job cancellation requested") {
    super(message);
    this.name = "CancellationRequestedError";
  }
}

export class RecipeProcessor {
  private queue: BullMQQueue | null = null;
  private worker: BullMQWorker<BullMQJobData> | null = null;
  private readonly registry = new PipelineRegistry();
  private readonly llmClient = createMistralClient();

  constructor(private readonly config: ProcessorConfig = {}) {}

  async start(): Promise<void> {
    this.queue = new BullMQQueue();
    await this.queue.waitUntilReady();

    const limiter = getRateLimiterConfig();
    const stalledInterval = getStalledIntervalMs();
    const maxStalledCount = getMaxStalledCount();

    const workerOptions: WorkerOptions = {
      connection: getRedisConnectionOptions(),
      concurrency: this.config.maxConcurrentJobs ?? 2,
      limiter: limiter ?? undefined,
      lockDuration: getLockDurationMs(),
      removeOnComplete: { count: getRemoveOnCompleteCount() },
      removeOnFail: { count: getRemoveOnFailCount() },
      ...(typeof stalledInterval === "number" ? { stalledInterval } : {}),
      ...(typeof maxStalledCount === "number" ? { maxStalledCount } : {}),
    };

    this.worker = new BullMQWorker<BullMQJobData>(
      this.queue.getQueueName(),
      async (bullmqJob, _token, signal) => {
        return this.process(bullmqJob, signal);
      },
      workerOptions,
    );

    this.worker.on("error", (error) => {
      console.error("BullMQ worker error", { error: String(error) });
    });
  }

  async stop(): Promise<void> {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
  }

  private async process(bullmqJob: BullMQJob<BullMQJobData>, bullmqSignal?: AbortSignal): Promise<unknown> {
    const queue = this.queue;
    if (!queue) {
      throw new Error("Processor not initialized");
    }

    const { data } = bullmqJob;
    const jobId = new JobId(String(bullmqJob.id));
    const debug = data.debug ?? this.config.debug ?? false;
    const pipelineId = data.pipelineId;

    const meta = await this.registry.getMeta(pipelineId);
    const runtime = await this.registry.getRuntime(pipelineId);
    const config = this.registry.getConfig(pipelineId);

    const controller = new AbortController();
    this.forwardSignal(bullmqSignal, controller);

    const writeJobLog = (message: string): void => {
      void bullmqJob.log(message).catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        consoleLogger.warn("Failed to write BullMQ job log", {
          jobId: jobId.toString(),
          error: errorMessage,
        });
      });
    };

    const stopCancellationMonitor = this.startCancellationMonitor({
      queue,
      jobId,
      controller,
      writeJobLog,
    });

    const throwIfCancellationRequested = async (
      stepId: string,
      phase: "step-started" | "step-completed",
    ): Promise<void> => {
      if (controller.signal.aborted) {
        throw new CancellationRequestedError(`Job canceled during ${phase}: ${stepId}`);
      }

      if (await queue.isCanceled(jobId)) {
        controller.abort();
        writeJobLog(`Cancellation detected during ${phase}: ${stepId}`);
        throw new CancellationRequestedError(`Job canceled during ${phase}: ${stepId}`);
      }
    };

    const reporter: PipelineReporter = {
      stepStarted: async (stepId) => {
        await throwIfCancellationRequested(stepId, "step-started");
        const stepIndex = meta.steps.findIndex((step) => step.id === stepId);
        const step = meta.steps[stepIndex];
        await bullmqJob.updateProgress({
          stepId,
          stepLabel: step?.label ?? stepId,
          stepCategory: step?.category ?? "extracting",
          status: "started",
          stepIndex: stepIndex >= 0 ? stepIndex : 0,
          totalSteps: meta.steps.length,
        });
        writeJobLog(`Step ${stepId} started`);
      },

      stepCompleted: async (stepId) => {
        await throwIfCancellationRequested(stepId, "step-completed");
        const stepIndex = meta.steps.findIndex((step) => step.id === stepId);
        const step = meta.steps[stepIndex];
        await bullmqJob.updateProgress({
          stepId,
          stepLabel: step?.label ?? stepId,
          stepCategory: step?.category ?? "extracting",
          status: "completed",
          stepIndex: stepIndex >= 0 ? stepIndex : 0,
          totalSteps: meta.steps.length,
        });
        writeJobLog(`Step ${stepId} completed`);
      },

      log: (message) => {
        writeJobLog(message);
      },

      addWarning: (warning) => {
        writeJobLog(`Warning ${warning.code}: ${warning.message}`);
      },
    };

    const deps: PipelineDeps = {
      fetch: createFetchClient(config?.network),
      inputs: tempInputStore,
      llm: this.llmClient,
      logger: consoleLogger,
      signal: controller.signal,
      context: {
        jobId: jobId.toString(),
        pipelineId,
        debug,
        inputRef: data.inputRef,
      },
    };

    try {
      const result = await runtime.execute(data.payload, deps, reporter);
      return result;
    } catch (error) {
      if (error instanceof CancellationRequestedError || controller.signal.aborted) {
        throw new UnrecoverableError("canceled");
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Pipeline execution failed");
    } finally {
      stopCancellationMonitor();
      if (data.inputRef) {
        try {
          await tempInputStore.delete(data.inputRef);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          consoleLogger.warn("Failed to cleanup temporary input reference", {
            jobId: jobId.toString(),
            inputRef: data.inputRef,
            error: errorMessage,
          });
        }
      }
    }
  }

  private forwardSignal(source: AbortSignal | undefined, target: AbortController): void {
    if (!source) return;
    if (source.aborted) {
      target.abort();
      return;
    }
    source.addEventListener("abort", () => target.abort(), { once: true });
  }

  private startCancellationMonitor({
    queue,
    jobId,
    controller,
    writeJobLog,
  }: Readonly<{
    queue: BullMQQueue;
    jobId: JobId;
    controller: AbortController;
    writeJobLog: (message: string) => void;
  }>): () => void {
    let stopped = false;
    let inFlight = false;

    const stop = (): void => {
      if (stopped) {
        return;
      }
      stopped = true;
      clearInterval(intervalId);
    };

    const checkCancellation = async (): Promise<void> => {
      if (stopped || inFlight || controller.signal.aborted) {
        return;
      }

      inFlight = true;
      try {
        if (await queue.isCanceled(jobId)) {
          writeJobLog("Cancellation detected from queue monitor");
          controller.abort();
          stop();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        consoleLogger.warn("Failed to check cancellation state", {
          jobId: jobId.toString(),
          error: errorMessage,
        });
      } finally {
        inFlight = false;
      }
    };

    const intervalId = setInterval(() => {
      void checkCancellation();
    }, CANCELLATION_POLL_INTERVAL_MS);

    controller.signal.addEventListener("abort", stop, { once: true });
    void checkCancellation();

    return stop;
  }
}
