import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { buildServer } from "./index";
import { ExecuteJob, LinearWorkflowRunner } from "@ria/application";
import { RegistryPipelineRunner, StaticPipelineRegistry, TextPipeline, UrlPipeline } from "@ria/pipelines";
import {
  BullMqWorkerRuntime,
  createDb,
  destroyDb,
  getDatabaseUrl,
  getRedisConnection,
  PostgresJobRepository,
  PostgresResultRepository,
  PostgresStepRunRepository,
  runMigrations
} from "@ria/infrastructure";

const waitForJobStatus = async (
  jobRepository: PostgresJobRepository,
  jobId: string,
  status: "SUCCEEDED" | "FAILED",
  timeoutMs = 5000
) => {
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

describe("API import flow", () => {
  const databaseUrl = getDatabaseUrl();
  const db = createDb(databaseUrl);
  const jobRepository = new PostgresJobRepository(db);
  const resultRepository = new PostgresResultRepository(db);
  const stepRunRepository = new PostgresStepRunRepository(db);
  const queueName = process.env.QUEUE_NAME ?? "import-jobs";
  const redisConnection = getRedisConnection();
  const fixtureHtml = readFileSync(
    join(process.cwd(), "fixtures", "url", "simple-recipe.html"),
    "utf-8"
  );
  const fixtureText = readFileSync(
    join(process.cwd(), "fixtures", "text", "simple-recipe.txt"),
    "utf-8"
  );

  const pipelineRunner = new RegistryPipelineRunner(
    new StaticPipelineRegistry([new UrlPipeline("url"), new TextPipeline("text")]),
    {
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined
      },
      artifactStore: {
        put: async () => "artifact://noop"
      },
        fetchProvider: {
          fetchHtml: async (url: string) => ({
            url,
            status: 200,
            headers: { "content-type": "text/html" },
            body: fixtureHtml
          })
        }
    },
    new LinearWorkflowRunner(jobRepository, stepRunRepository)
  );

  const executeJob = new ExecuteJob(jobRepository, resultRepository, pipelineRunner);
  const workerRuntime = new BullMqWorkerRuntime(executeJob, {
    queueName,
    connection: redisConnection
  });

  beforeAll(async () => {
    await runMigrations(databaseUrl);
    await workerRuntime.start();
  });

  beforeEach(async () => {
    await db.deleteFrom("job_step_runs").execute();
    await db.deleteFrom("job_results").execute();
    await db.deleteFrom("import_jobs").execute();
  });

  afterAll(async () => {
    await workerRuntime.stop();
    await destroyDb(db);
  });

  it("creates a job and returns result", async () => {
    const app = await buildServer();

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/import/from-url",
      headers: { "x-user-id": "user-1" },
      payload: { url: "https://example.test" }
    });

    expect(createResponse.statusCode).toBe(200);
    const { jobId } = createResponse.json() as { jobId: string };

    const statusResponse = await app.inject({
      method: "GET",
      url: `/v1/jobs/${jobId}`,
      headers: { "x-user-id": "user-1" }
    });

    expect(statusResponse.statusCode).toBe(200);

    await waitForJobStatus(jobRepository, jobId, "SUCCEEDED");

    const resultResponse = await app.inject({
      method: "GET",
      url: `/v1/jobs/${jobId}/result`,
      headers: { "x-user-id": "user-1" }
    });

    expect(resultResponse.statusCode).toBe(200);
    const result = resultResponse.json() as { recipe: { name: string } };
    expect(result.recipe.name).toBe("Simple Lemonade");

    await app.close();
  });

  it("creates a text job and returns result", async () => {
    const app = await buildServer();

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/import/from-text",
      headers: { "x-user-id": "user-1" },
      payload: { text: fixtureText }
    });

    expect(createResponse.statusCode).toBe(200);
    const { jobId } = createResponse.json() as { jobId: string };

    await waitForJobStatus(jobRepository, jobId, "SUCCEEDED");

    const resultResponse = await app.inject({
      method: "GET",
      url: `/v1/jobs/${jobId}/result`,
      headers: { "x-user-id": "user-1" }
    });

    expect(resultResponse.statusCode).toBe(200);
    const result = resultResponse.json() as { recipe: { name: string } };
    expect(result.recipe.name).toBe("Simple Pancakes");

    await app.close();
  });

  it("rejects missing user id", async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: "POST",
      url: "/v1/import/from-url",
      payload: { url: "https://example.test" }
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it("rejects access to another user's job", async () => {
    const app = await buildServer();

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/import/from-url",
      headers: { "x-user-id": "user-1" },
      payload: { url: "https://example.test" }
    });

    const { jobId } = createResponse.json() as { jobId: string };

    const response = await app.inject({
      method: "GET",
      url: `/v1/jobs/${jobId}`,
      headers: { "x-user-id": "user-2" }
    });

    expect(response.statusCode).toBe(403);

    await app.close();
  });
});
