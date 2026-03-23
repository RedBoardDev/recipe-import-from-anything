import type { CanonicalRecipe, EvidenceBundle, ProgressCheckpoint, TextExtractionResult } from "@recipe/domain";
import { Confidence, ImportResult, JobId, Warning } from "@recipe/domain";
import type { FormatterDeps, PipelineDeps, PipelineProgressReporter, StepDefinition } from "@recipe/pipeline-contracts";
import { type Job as BullMQJob, Worker as BullMQWorker, UnrecoverableError, type WorkerOptions } from "bullmq";
import { RecipeFormatterService } from "../application/services/recipe-formatter-service.js";
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
import { createJobProgressTracker } from "../infrastructure/bullmq/progress-state.js";
import { BullMQQueue } from "../infrastructure/bullmq/queue.js";
import type { BullMQJobData } from "../infrastructure/bullmq/types.js";
import { createFetchClient } from "../infrastructure/fetch.js";
import { consoleLogger } from "../infrastructure/logger.js";
import { createMistralClient } from "../infrastructure/mistral-client.js";
import { createMistralOcrClient } from "../infrastructure/mistral-ocr-client.js";
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

/**
 * Creates a PipelineProgressReporter backed by a BullMQ job.
 */
const createProgressReporter = (
  bullmqJob: BullMQJob<BullMQJobData>,
  jobId: JobId,
  steps: readonly StepDefinition[],
  writeJobLog: (message: string) => void,
): PipelineProgressReporter => {
  const progressTracker = createJobProgressTracker(steps);
  const updateProgress = (nextProgress: ReturnType<typeof progressTracker.setStatus>): void => {
    void bullmqJob.updateProgress(nextProgress).catch((error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      consoleLogger.warn("Failed to update job progress", {
        jobId: jobId.toString(),
        error: errorMessage,
      });
    });
  };

  return {
    checkpoint: (checkpoint: ProgressCheckpoint): void => {
      updateProgress(progressTracker.checkpoint(checkpoint));
      writeJobLog(`Checkpoint: ${checkpoint}`);
    },
    setStatus: (status): void => {
      updateProgress(progressTracker.setStatus(status));
      writeJobLog(`Status: ${status}`);
    },
    log: (message: string): void => {
      writeJobLog(message);
    },
  };
};

export class RecipeProcessor {
  private queue: BullMQQueue | null = null;
  private worker: BullMQWorker<BullMQJobData> | null = null;
  private readonly registry = new PipelineRegistry();
  private readonly llmClient = createMistralClient();
  private readonly ocrClient = createMistralOcrClient();
  private readonly recipeFormatter = new RecipeFormatterService();

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

  private async process(bullmqJob: BullMQJob<BullMQJobData>, bullmqSignal?: AbortSignal): Promise<ImportResult> {
    const queue = this.queue;
    if (!queue) {
      throw new Error("Processor not initialized");
    }

    const data = bullmqJob.data;
    const jobId = new JobId(String(bullmqJob.id));
    const debug = data.debug ?? this.config.debug ?? false;
    const pipelineId = data.pipelineId;

    const [meta, runtime] = await Promise.all([
      this.registry.getMeta(pipelineId),
      this.registry.getRuntime(pipelineId),
    ]);

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

    try {
      // PHASE 1: Pipeline extraction (collecting + extracting)
      const reporter = createProgressReporter(bullmqJob, jobId, meta.steps, writeJobLog);

      const pipelineDeps: PipelineDeps = {
        fetch: createFetchClient(),
        inputs: tempInputStore,
        llm: this.llmClient,
        ocr: this.ocrClient,
        logger: consoleLogger,
        signal: controller.signal,
        context: {
          jobId: jobId.toString(),
          pipelineId,
          debug,
          inputRef: data.inputRef,
        },
      };

      meta.inputSchema.parse(data.payload);
      const extraction: TextExtractionResult = await runtime.execute(data.payload as never, pipelineDeps, reporter);

      writeJobLog(`Pipeline extraction completed: ${extraction.metadata.sourceType}`);

      // PHASE 2: Recipe formatting (LLM)
      if (controller.signal.aborted) {
        throw new CancellationRequestedError("Job canceled during formatting");
      }

      const formatterDeps: FormatterDeps = {
        llm: this.llmClient,
        logger: consoleLogger,
        signal: controller.signal,
        context: {
          jobId: jobId.toString(),
          pipelineId,
          sourceType: extraction.metadata.sourceType,
          sourceValue: extraction.metadata.sourceValue,
        },
      };

      const recipe: CanonicalRecipe = await this.recipeFormatter.format(extraction, formatterDeps, reporter);

      writeJobLog(`Recipe formatting completed: ${recipe.name}`);

      // PHASE 3: Calculate confidence and create result
      const confidence = this.calculateRecipeConfidence(recipe, extraction.metadata.extractionConfidence);

      const evidence: EvidenceBundle = {
        artifactRefs: [...(extraction.artifactRefs ?? [])],
        debug: {
          rawText: extraction.rawText.substring(0, 500),
          extractionConfidence: extraction.metadata.extractionConfidence,
          recipeConfidence: confidence.value,
          sourceType: extraction.metadata.sourceType,
        },
      };

      const warnings: Warning[] = [...(extraction.warnings ?? [])];
      if (confidence.level === "low") {
        warnings.push(new Warning("LOW_CONFIDENCE", "Low confidence extraction: recipe data may be incomplete"));
      }

      const result = new ImportResult(
        recipe,
        confidence,
        evidence,
        warnings,
        extraction.metadata.sourceType,
        extraction.metadata.sourceValue ?? "",
      );

      // Final checkpoint
      reporter.checkpoint("completed");

      writeJobLog(`Job completed successfully: ${result.recipe.name}`);
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

  /**
   * Calculates the final recipe confidence score.
   */
  private calculateRecipeConfidence(recipe: CanonicalRecipe, extractionConfidence: number): Confidence {
    // Base score: 0.1 (minimum)
    let score = 0.1;

    // Champs critiques (50% total)
    if (recipe.name && recipe.name.trim().length > 0) score += 0.3;
    if (recipe.ingredients && recipe.ingredients.length > 0) score += 0.12;
    if (recipe.instructions && recipe.instructions.length > 0) score += 0.08;

    // Champs importants (25% total)
    if (recipe.description && recipe.description.trim().length > 0) score += 0.05;
    if (recipe.prepTimeMin || recipe.cookTimeMin) score += 0.1;
    if (recipe.servings) score += 0.05;
    if (recipe.author && (typeof recipe.author === "string" || recipe.author?.name)) score += 0.05;

    // Champs bonus (15% total)
    if (recipe.nutrition) score += 0.04;
    if (recipe.image) score += 0.03;
    if (recipe.keywords && recipe.keywords.length > 0) score += 0.02;
    if (recipe.cuisine) score += 0.02;
    if (recipe.categories && recipe.categories.length > 0) score += 0.02;
    if (recipe.attributes && recipe.attributes.length > 0) score += 0.02;

    // Clamp entre 0 et 1
    const recipeConfidence = Math.max(0, Math.min(score, 1));

    // Combine avec extractionConfidence (70% recipe, 30% extraction)
    const combinedConfidence = recipeConfidence * 0.7 + extractionConfidence * 0.3;

    return new Confidence(combinedConfidence);
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
