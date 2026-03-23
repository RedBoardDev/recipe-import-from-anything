// Data stored in each BullMQ job
export interface BullMQJobData {
  userId: string;
  pipelineId: string;
  payload: unknown;
  idempotencyKey?: string;
  inputRef?: string;
  debug?: boolean;
}
