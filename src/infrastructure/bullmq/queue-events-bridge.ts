import type { JobId, UserId } from "@recipe/domain";
import { QueueEvents } from "bullmq";
import type { EventBridgePort } from "../../application/ports.js";
import type { RedisConnectionOptions } from "./config.js";

type Subscription = { userId: UserId; send: (data: object) => void };

export class QueueEventsBridge implements EventBridgePort {
  private readonly queueEvents: QueueEvents;
  private readonly subscriptions = new Map<string, Set<Subscription>>();

  constructor(queueName: string, connection: RedisConnectionOptions) {
    this.queueEvents = new QueueEvents(queueName, { connection });

    this.queueEvents.on("active", ({ jobId }) => {
      this.dispatch(jobId, { type: "job.active", jobId });
    });

    this.queueEvents.on("progress", ({ jobId, data }) => {
      this.dispatch(jobId, { type: "job.progress", jobId, ...(data as object) });
    });

    this.queueEvents.on("completed", ({ jobId }) => {
      this.dispatch(jobId, { type: "job.completed", jobId });
    });

    this.queueEvents.on("failed", ({ jobId, failedReason }) => {
      const isCanceled = failedReason?.includes("canceled");
      this.dispatch(jobId, {
        type: isCanceled ? "job.canceled" : "job.failed",
        jobId,
        ...(isCanceled ? {} : { reason: failedReason }),
      });
    });

    this.queueEvents.on("stalled", ({ jobId }) => {
      this.dispatch(jobId, { type: "job.stalled", jobId });
    });
  }

  addSubscription(jobId: JobId, userId: UserId, send: (data: object) => void): void {
    const key = jobId.toString();
    const existing = this.subscriptions.get(key);
    const next = existing ? new Set(existing) : new Set<Subscription>();
    next.add({ userId, send });
    this.subscriptions.set(key, next);
  }

  removeSubscription(jobId: JobId, userId: UserId, send?: (data: object) => void): void {
    const key = jobId.toString();
    const existing = this.subscriptions.get(key);
    if (!existing) return;

    const next = new Set([...existing].filter((sub) => (send ? sub.send !== send : !sub.userId.equals(userId))));

    if (next.size === 0) {
      this.subscriptions.delete(key);
    } else {
      this.subscriptions.set(key, next);
    }
  }

  removeAllSubscriptions(jobId: JobId): void {
    this.subscriptions.delete(jobId.toString());
  }

  async close(): Promise<void> {
    await this.queueEvents.close();
  }

  private dispatch(jobId: string, event: object): void {
    const subs = this.subscriptions.get(jobId);
    if (!subs) return;

    for (const sub of subs) {
      try {
        sub.send(event);
      } catch {
        // Ignore send errors
      }
    }
  }
}
