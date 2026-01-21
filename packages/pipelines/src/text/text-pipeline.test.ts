import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ImportJob, ImportResult } from "@ria/domain";
import type { JobRepository, StepRunRepository, StepRun } from "@ria/application";
import { LinearWorkflowRunner } from "@ria/application";
import { RegistryPipelineRunner, StaticPipelineRegistry, TextPipeline } from "@ria/pipelines";

class InMemoryJobRepository implements JobRepository {
  private readonly jobs = new Map<string, ImportJob>();

  async create(job: ImportJob): Promise<void> {
    this.jobs.set(job.id, job);
  }

  async update(job: ImportJob): Promise<void> {
    this.jobs.set(job.id, job);
  }

  async getById(jobId: string): Promise<ImportJob | null> {
    return this.jobs.get(jobId) ?? null;
  }
}

class InMemoryStepRunRepository implements StepRunRepository {
  private readonly runs: StepRun[] = [];

  async startRun(jobId: string, stepId: string): Promise<string> {
    const id = randomUUID();
    this.runs.push({
      id,
      jobId,
      stepId,
      status: "RUNNING",
      startedAt: new Date().toISOString()
    });

    return id;
  }

  async finishRun(runId: string, status: "SUCCEEDED" | "FAILED", data?: { outputRef?: string; meta?: Record<string, unknown> }): Promise<void> {
    const run = this.runs.find((entry) => entry.id === runId);
    if (!run) {
      return;
    }

    const endedAt = new Date();
    run.status = status;
    run.endedAt = endedAt.toISOString();
    run.durationMs = endedAt.getTime() - new Date(run.startedAt).getTime();
    run.outputRef = data?.outputRef;
    run.meta = data?.meta;
  }

  async failRun(runId: string, error: { code: string; message: string; stepId?: string }, data?: { outputRef?: string; meta?: Record<string, unknown> }): Promise<void> {
    const run = this.runs.find((entry) => entry.id === runId);
    if (!run) {
      return;
    }

    const endedAt = new Date();
    run.status = "FAILED";
    run.error = error;
    run.endedAt = endedAt.toISOString();
    run.durationMs = endedAt.getTime() - new Date(run.startedAt).getTime();
    run.outputRef = data?.outputRef;
    run.meta = data?.meta;
  }

  async listByJobId(jobId: string): Promise<StepRun[]> {
    return this.runs.filter((run) => run.jobId === jobId);
  }
}

const makeJob = (text: string): ImportJob => {
  const now = new Date().toISOString();

  return {
    id: randomUUID(),
    userId: "user-1",
    sourceType: "text",
    payload: { text },
    options: { llmPolicy: "never", debug: false },
    status: "PENDING",
    progressPct: 0,
    warnings: [],
    errors: [],
    createdAt: now,
    updatedAt: now
  };
};

describe("Text pipeline", () => {
  const cases = [
    {
      fixture: "simple-recipe",
      name: "Simple Pancakes"
    },
    {
      fixture: "compact-recipe",
      name: "Quick Oatmeal"
    }
  ];

  for (const testCase of cases) {
    it(`extracts a recipe from ${testCase.fixture}`, async () => {
      const text = readFileSync(
        join(process.cwd(), "fixtures", "text", `${testCase.fixture}.txt`),
        "utf-8"
      );
      const expected = JSON.parse(
        readFileSync(
          join(process.cwd(), "expected", "text", `${testCase.fixture}.json`),
          "utf-8"
        )
      ) as ImportResult["recipe"];

      const job = makeJob(text);
      const jobRepository = new InMemoryJobRepository();
      const stepRunRepository = new InMemoryStepRunRepository();
      await jobRepository.create(job);

    const workflowRunner = new LinearWorkflowRunner(jobRepository, stepRunRepository);
    const pipelineRunner = new RegistryPipelineRunner(
      new StaticPipelineRegistry([new TextPipeline("text")]),
      {
        logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
        artifactStore: { put: async () => "artifact://noop" },
        fetchProvider: {
          fetchHtml: async (url: string) => ({
            url,
            status: 200,
            headers: { "content-type": "text/plain" },
            body: ""
          })
        }
      },
      workflowRunner
    );

      const result = await pipelineRunner.run(job);

      expect(result.recipe).toEqual(expected);
      expect(result.recipe.name).toBe(testCase.name);
      expect(result.confidence.overall).toBeGreaterThan(0);
    });
  }
});
