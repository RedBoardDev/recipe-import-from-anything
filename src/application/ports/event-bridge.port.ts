import type { JobId, UserId } from "@recipe/domain";

export interface EventBridgePort {
  addSubscription(jobId: JobId, userId: UserId, send: (data: object) => void): void;
  removeSubscription(jobId: JobId, userId: UserId, send?: (data: object) => void): void;
  removeAllSubscriptions(jobId: JobId): void;
  close(): Promise<void>;
}
