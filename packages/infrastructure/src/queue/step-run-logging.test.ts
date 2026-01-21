import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { ImportJob, ImportResult, SchemaOrgRecipe } from "@ria/domain";
import { ExecuteJob, LinearWorkflowRunner } from "@ria/application";
import type { Step, WorkflowDefinition } from "@ria/application";
import { RegistryPipelineRunner, StaticPipelineRegistry } from "@ria/pipelines";
import {
  createDb,
  destroyDb,
  getDatabaseUrl,
  PostgresJobRepository,
  PostgresResultRepository,
  PostgresStepRunRepository,
  runMigrations
} from "../index";

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

const makeRecipe = (): SchemaOrgRecipe => ({
  "@type": "Recipe",
  name: "Noop",
  recipeIngredient: ["Water"],
  recipeInstructions: ["Ok"]
});

const finalizeResult = (job: ImportJob, recipe: SchemaOrgRecipe): ImportResult => ({
  recipe,
  confidence: { overall: 0.1, fields: { name: 0.1 } },
  evidence: { refs: [] },
  warnings: [],
  errors: [],
  meta: {
    pipelineId: "noop",
    steps: [],
    llmPolicy: job.options.llmPolicy,
    debug: job.options.debug,
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString()
  }
});

const buildWorkflow = (job: ImportJob): WorkflowDefinition<ImportJob, SchemaOrgRecipe> => {
  const step1: Step<ImportJob, ImportJob> = {
    id: "noop.step1",
    run: async (input) => input
  };

  const step2: Step<ImportJob, SchemaOrgRecipe> = {
    id: "noop.step2",
    run: async () => makeRecipe()
  };

  return {
    id: "noop",
    steps: [step1, step2],
    initialInput: job,
    finalize: (output) => finalizeResult(job, output)
  };
};

const buildFailingWorkflow = (job: ImportJob): WorkflowDefinition<ImportJob, SchemaOrgRecipe> => {
  const step1: Step<ImportJob, ImportJob> = {
    id: "noop.step1",
    run: async (input) => input
  };

  const step2: Step<ImportJob, SchemaOrgRecipe> = {
    id: "noop.step2",
    run: async () => {
      throw new Error("boom");
    }
  };

  return {
    id: "noop",
    steps: [step1, step2],
    initialInput: job,
    finalize: () => finalizeResult(job, makeRecipe())
  };
};

describe("Workflow step logging", () => {
  const databaseUrl = getDatabaseUrl();
  const db = createDb(databaseUrl);
  const jobRepository = new PostgresJobRepository(db);
  const resultRepository = new PostgresResultRepository(db);
  const stepRunRepository = new PostgresStepRunRepository(db);
  const workflowRunner = new LinearWorkflowRunner(jobRepository, stepRunRepository);

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

  it("logs step runs in order with durations", async () => {
    const job = makeJob();
    await jobRepository.create(job);

    const pipelineRunner = new RegistryPipelineRunner(
      new StaticPipelineRegistry([
        {
          id: "noop",
          sourceType: "url",
          createWorkflow: () => buildWorkflow(job)
        }
      ]),
      {
        logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
        artifactStore: { put: async () => "artifact://noop" },
        fetchProvider: {
          fetchHtml: async (url: string) => ({
            url,
            status: 200,
            headers: { "content-type": "text/html" },
            body: "<html></html>"
          })
        }
      },
      workflowRunner
    );

    const executeJob = new ExecuteJob(jobRepository, resultRepository, pipelineRunner);
    await executeJob.execute({ jobId: job.id });

    const runs = await stepRunRepository.listByJobId(job.id);
    expect(runs).toHaveLength(2);
    expect(runs[0]?.stepId).toBe("noop.step1");
    expect(runs[1]?.stepId).toBe("noop.step2");
    expect(runs[0]?.durationMs).toBeTypeOf("number");
  });

  it("marks failed steps and job status", async () => {
    const job = makeJob();
    await jobRepository.create(job);

    const pipelineRunner = new RegistryPipelineRunner(
      new StaticPipelineRegistry([
        {
          id: "noop",
          sourceType: "url",
          createWorkflow: () => buildFailingWorkflow(job)
        }
      ]),
      {
        logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
        artifactStore: { put: async () => "artifact://noop" },
        fetchProvider: {
          fetchHtml: async (url: string) => ({
            url,
            status: 200,
            headers: { "content-type": "text/html" },
            body: "<html></html>"
          })
        }
      },
      workflowRunner
    );

    const executeJob = new ExecuteJob(jobRepository, resultRepository, pipelineRunner);

    await expect(executeJob.execute({ jobId: job.id })).rejects.toThrow("boom");

    const storedJob = await jobRepository.getById(job.id);
    expect(storedJob?.status).toBe("FAILED");

    const runs = await stepRunRepository.listByJobId(job.id);
    expect(runs).toHaveLength(2);
    const failedRun = runs.find((run) => run.stepId === "noop.step2");
    expect(failedRun?.status).toBe("FAILED");
    expect(failedRun?.error?.code).toBe("STEP_FAILED");
  });
});
