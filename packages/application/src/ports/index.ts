import type {
  ImportError,
  ImportJob,
  ImportResult
} from "@ria/domain";

export interface JobRepository {
  create(job: ImportJob): Promise<void>;
  update(job: ImportJob): Promise<void>;
  getById(jobId: string): Promise<ImportJob | null>;
}

export interface ResultRepository {
  save(jobId: string, result: ImportResult): Promise<void>;
  getByJobId(jobId: string): Promise<ImportResult | null>;
}

export interface StepRunRepository {
  startRun(jobId: string, stepId: string): Promise<string>;
  finishRun(
    runId: string,
    status: "SUCCEEDED" | "FAILED",
    data?: StepRunData
  ): Promise<void>;
  failRun(runId: string, error: ImportError, data?: StepRunData): Promise<void>;
  listByJobId(jobId: string): Promise<StepRun[]>;
}

export interface StepRun {
  id: string;
  jobId: string;
  stepId: string;
  status: "RUNNING" | "SUCCEEDED" | "FAILED";
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  error?: ImportError;
  outputRef?: string;
  meta?: Record<string, unknown>;
}

export interface StepRunData {
  outputRef?: string;
  meta?: Record<string, unknown>;
}

export interface JobQueue {
  enqueue(jobId: string): Promise<void>;
}

export interface ArtifactStore {
  put(
    key: string,
    data: string | Buffer,
    contentType: string
  ): Promise<string>;
}

export interface FetchResult {
  url: string;
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface FetchProvider {
  fetchHtml(url: string): Promise<FetchResult>;
}

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface LLMProvider {
  generate(prompt: string, options?: Record<string, unknown>): Promise<LLMResponse>;
}

export interface LLMResponse {
  text: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  model?: string;
}

export interface EventBus {
  publish(topic: string, payload: Record<string, unknown>): Promise<void>;
}

export type { PipelineRunner } from "./pipeline-runner";
