import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import type { ImportJob } from "@ria/domain";
import { ExecuteJob, LinearWorkflowRunner } from "@ria/application";
import { NoopPipeline, RegistryPipelineRunner, StaticPipelineRegistry } from "@ria/pipelines";
import {
  BullMqJobQueue,
  BullMqWorkerRuntime,
  createDb,
  destroyDb,
  getDatabaseUrl,
  getRedisConnection,
  PostgresStepRunRepository,
  PostgresJobRepository,
  PostgresResultRepository,
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

const logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined
};

const artifactStore = {
  put: async (_key: string) => "artifact://noop"
};

const fetchProvider = {
  fetchHtml: async (url: string) => ({
    url,
    status: 200,
    headers: { "content-type": "text/html" },
    body: "<html></html>"
  })
};

const waitForStatus = async (
  jobRepository: PostgresJobRepository,
  jobId: string,
  status: ImportJob["status"],
  timeoutMs = 4000
): Promise<ImportJob> => {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const job = await jobRepository.getById(jobId);
    if (job && job.status === status) {
      return job;
    }
    await sleep(200);
  }

  throw new Error(`Timeout waiting for job ${jobId} to reach status ${status}`);
};

describe("BullMQ job flow", () => {
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

  it("enqueues and processes a job", async () => {
    const job = makeJob();
    await jobRepository.create(job);

    const workflowRunner = new LinearWorkflowRunner(jobRepository, stepRunRepository);
    const pipelineRunner = new RegistryPipelineRunner(
      new StaticPipelineRegistry([new NoopPipeline("url")]),
      { logger, artifactStore, fetchProvider },
      workflowRunner
    );

    const executeJob = new ExecuteJob(
      jobRepository,
      resultRepository,
      pipelineRunner
    );

    const redisConnection = getRedisConnection();
    const queueName = "import-jobs";

    const jobQueue = new BullMqJobQueue({
      queueName,
      connection: redisConnection
    });

    const workerRuntime = new BullMqWorkerRuntime(executeJob, {
      queueName,
      connection: redisConnection
    });

    await workerRuntime.start();
    await jobQueue.enqueue(job.id);

    const storedJob = await waitForStatus(jobRepository, job.id, "SUCCEEDED");
    const result = await resultRepository.getByJobId(job.id);

    await workerRuntime.stop();
    await jobQueue.close();

    expect(storedJob.status).toBe("SUCCEEDED");
    expect(result).not.toBeNull();
  });
});
