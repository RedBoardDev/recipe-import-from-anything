import { describe, expect, it, beforeAll, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import type { ImportJob, ImportResult } from "@ria/domain";
import { createDb, destroyDb, getDatabaseUrl, runMigrations } from "../index";
import { PostgresJobRepository } from "./postgres-job-repository";
import { PostgresResultRepository } from "./postgres-result-repository";
import { PostgresStepRunRepository } from "./postgres-step-run-repository";

const makeJob = (overrides: Partial<ImportJob> = {}): ImportJob => {
  const now = new Date().toISOString();

  return {
    id: randomUUID(),
    userId: "user-1",
    sourceType: "url",
    payload: { url: "https://example.test" },
    options: { llmPolicy: "never", debug: false },
    status: "PENDING",
    progressPct: 0,
    warnings: [],
    errors: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
};

const makeResult = (): ImportResult => {
  const now = new Date().toISOString();

  return {
    recipe: {
      "@type": "Recipe",
      name: "Test Recipe",
      recipeIngredient: ["Salt"],
      recipeInstructions: ["Mix"]
    },
    confidence: {
      overall: 0.9,
      fields: {
        name: 0.9
      }
    },
    evidence: {
      refs: []
    },
    warnings: [],
    errors: [],
    meta: {
      pipelineId: "noop",
      steps: [],
      llmPolicy: "never",
      debug: false,
      startedAt: now,
      endedAt: now
    }
  };
};

describe("Postgres repositories", () => {
  const databaseUrl = getDatabaseUrl();
  const db = createDb(databaseUrl);
  const jobRepository = new PostgresJobRepository(db);
  const resultRepository = new PostgresResultRepository(db);
  const stepRunRepository = new PostgresStepRunRepository(db);

  beforeAll(async () => {
    await runMigrations(databaseUrl);
  });

  beforeEach(async () => {
    await db.deleteFrom("job_step_runs").execute();
    await db.deleteFrom("job_results").execute();
    await db.deleteFrom("import_jobs").execute();
  });

  afterAll(async () => {
    await destroyDb(db);
  });

  it("creates and retrieves a job", async () => {
    const job = makeJob();
    await jobRepository.create(job);

    const stored = await jobRepository.getById(job.id);
    expect(stored).not.toBeNull();
    expect(stored?.id).toBe(job.id);
    expect(stored?.payload).toEqual(job.payload);
  });

  it("saves and retrieves a result", async () => {
    const job = makeJob();
    await jobRepository.create(job);

    const result = makeResult();
    await resultRepository.save(job.id, result);

    const stored = await resultRepository.getByJobId(job.id);
    expect(stored).not.toBeNull();
    expect(stored?.recipe).toEqual(result.recipe);
  });

  it("records and lists step runs", async () => {
    const job = makeJob();
    await jobRepository.create(job);

    const runId = await stepRunRepository.startRun(job.id, "step-1");
    await stepRunRepository.finishRun(runId, "SUCCEEDED", { note: "ok" });

    const runs = await stepRunRepository.listByJobId(job.id);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.stepId).toBe("step-1");
    expect(runs[0]?.status).toBe("SUCCEEDED");
  });
});
