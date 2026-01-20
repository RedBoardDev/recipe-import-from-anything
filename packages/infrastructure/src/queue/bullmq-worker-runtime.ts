import { Worker } from "bullmq";
import type { ExecuteJob } from "@ria/application";
import type { RedisConnectionOptions } from "./redis";

export interface BullMqWorkerRuntimeConfig {
  queueName: string;
  connection: RedisConnectionOptions;
}

export class BullMqWorkerRuntime {
  private worker: Worker | null = null;

  constructor(
    private readonly executeJob: ExecuteJob,
    private readonly config: BullMqWorkerRuntimeConfig
  ) {}

  async start(): Promise<void> {
    if (this.worker) {
      return;
    }

    this.worker = new Worker(
      this.config.queueName,
      async (job) => {
        const { jobId } = job.data as { jobId: string };
        await this.executeJob.execute({ jobId });
      },
      { connection: this.config.connection }
    );

    await this.worker.waitUntilReady();
  }

  async stop(): Promise<void> {
    if (!this.worker) {
      return;
    }

    await this.worker.close();
    this.worker = null;
  }
}
