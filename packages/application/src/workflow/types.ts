import type { ImportJob, ImportResult } from "@ria/domain";
import type { ArtifactStore, FetchProvider, Logger, StepRun } from "../ports/index";

export interface StepContext {
  job: ImportJob;
  logger: Logger;
  artifactStore: ArtifactStore;
  fetchProvider: FetchProvider;
}

export interface StepRunOutput<T> {
  output: T;
  outputRef?: string;
  meta?: Record<string, unknown>;
}

export interface Step<I, O> {
  id: string;
  run(input: I, ctx: StepContext): Promise<O | StepRunOutput<O>>;
}

export interface WorkflowDefinition<I, O> {
  id: string;
  steps: Step<unknown, unknown>[];
  initialInput: I;
  finalize(output: O, ctx: StepContext, stepRuns: StepRun[]): ImportResult;
}

export interface WorkflowRunner {
  run<I, O>(workflow: WorkflowDefinition<I, O>, ctx: StepContext): Promise<ImportResult>;
}
