import type { CreateJobFromText, CreateJobFromUrl, GetJob, GetResult } from "@ria/application";
import { CreateJobFromText as CreateJobFromTextUseCase } from "@ria/application";
import { CreateJobFromUrl as CreateJobFromUrlUseCase } from "@ria/application";
import { GetJob as GetJobUseCase } from "@ria/application";
import { GetResult as GetResultUseCase } from "@ria/application";
import {
  BullMqJobQueue,
  createDb,
  destroyDb,
  getDatabaseUrl,
  getRedisConnection,
  PostgresJobRepository,
  PostgresResultRepository
} from "@ria/infrastructure";

export interface ApiRuntime {
  createJobFromUrl: CreateJobFromUrl;
  createJobFromText: CreateJobFromText;
  getJob: GetJob;
  getResult: GetResult;
  shutdown: () => Promise<void>;
}

export const buildApiRuntime = (): ApiRuntime => {
  const db = createDb(getDatabaseUrl());
  const jobRepository = new PostgresJobRepository(db);
  const resultRepository = new PostgresResultRepository(db);
  const jobQueue = new BullMqJobQueue({
    queueName: process.env.QUEUE_NAME ?? "import-jobs",
    connection: getRedisConnection()
  });

  return {
    createJobFromUrl: new CreateJobFromUrlUseCase(jobRepository, jobQueue),
    createJobFromText: new CreateJobFromTextUseCase(jobRepository, jobQueue),
    getJob: new GetJobUseCase(jobRepository),
    getResult: new GetResultUseCase(resultRepository),
    shutdown: async () => {
      await jobQueue.close();
      await destroyDb(db);
    }
  };
};
