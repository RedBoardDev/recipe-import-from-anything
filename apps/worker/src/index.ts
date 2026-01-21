import { ExecuteJob, LinearWorkflowRunner } from "@ria/application";
import { NoopPipeline, RegistryPipelineRunner, StaticPipelineRegistry, TextPipeline, UrlPipeline } from "@ria/pipelines";
import {
  BullMqWorkerRuntime,
  createDb,
  createPinoLogger,
  destroyDb,
  FileArtifactStore,
  getDatabaseUrl,
  getRedisConnection,
  NodeFetchProvider,
  PostgresJobRepository,
  PostgresResultRepository,
  PostgresStepRunRepository
} from "@ria/infrastructure";

const resolvePipelineMode = (): "real" | "noop" => {
  const mode = (process.env.PIPELINE_MODE ?? "real").toLowerCase();
  return mode === "noop" ? "noop" : "real";
};

const buildPipelineRegistry = () => {
  const mode = resolvePipelineMode();
  const urlPipeline = mode === "noop" ? new NoopPipeline("url", "noop-url") : new UrlPipeline("url");
  const textPipeline = mode === "noop" ? new NoopPipeline("text", "noop-text") : new TextPipeline("text");

  return new StaticPipelineRegistry([urlPipeline, textPipeline]);
};

const startWorker = async (): Promise<void> => {
  const db = createDb(getDatabaseUrl());
  const jobRepository = new PostgresJobRepository(db);
  const resultRepository = new PostgresResultRepository(db);
  const stepRunRepository = new PostgresStepRunRepository(db);

  const logger = createPinoLogger({
    level: process.env.LOG_LEVEL ?? "info",
    base: { service: "recipe-import-worker" }
  });
  const artifactStore = new FileArtifactStore({
    baseDir: process.env.ARTIFACTS_DIR ?? "artifacts"
  });
  const fetchProvider = new NodeFetchProvider();

  const workflowRunner = new LinearWorkflowRunner(jobRepository, stepRunRepository);
  const pipelineRunner = new RegistryPipelineRunner(
    buildPipelineRegistry(),
    { logger, artifactStore, fetchProvider },
    workflowRunner
  );

  const executeJob = new ExecuteJob(jobRepository, resultRepository, pipelineRunner);

  const workerRuntime = new BullMqWorkerRuntime(executeJob, {
    queueName: process.env.QUEUE_NAME ?? "import-jobs",
    connection: getRedisConnection()
  });

  await workerRuntime.start();
  logger.info("Worker started", { pipelineMode: resolvePipelineMode() });

  const shutdown = async () => {
    logger.info("Worker shutting down");
    await workerRuntime.stop();
    await destroyDb(db);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

startWorker().catch((error) => {
  console.error(error);
  process.exit(1);
});
