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
import { tempInputStore } from "../infrastructure/temp-input-store.js";

interface ProcessorConfig {
  maxConcurrentJobs?: number;
  debug?: boolean;
}

export class RecipeProcessor {
  private queue: BullMQQueue | null = null;
  private worker: BullMQWorker<BullMQJobData> | null = null;
  private readonly registry = new PipelineRegistry();

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

    const reporter: PipelineReporter = {
      stepStarted: async (stepId) => {
        if (await queue.isCanceled(jobId)) {
          controller.abort();
          return;
        }
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
      if (controller.signal.aborted) {
        throw new UnrecoverableError("canceled");
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Pipeline execution failed");
    } finally {
      if (data.inputRef) {
        await tempInputStore.delete(data.inputRef);
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
}
