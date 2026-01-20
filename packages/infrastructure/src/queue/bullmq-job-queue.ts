import { Queue } from "bullmq";
import type { JobQueue } from "@ria/application";
import type { RedisConnectionOptions } from "./redis";

export interface BullMqJobQueueConfig {
  queueName: string;
  connection: RedisConnectionOptions;
}

export class BullMqJobQueue implements JobQueue {
  private readonly queue: Queue;

  constructor(private readonly config: BullMqJobQueueConfig) {
    this.queue = new Queue(config.queueName, {
      connection: config.connection
    });
  }

  async enqueue(jobId: string): Promise<void> {
    await this.queue.add("execute", { jobId }, {
      removeOnComplete: true,
      removeOnFail: false
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
