import {
  DEFAULT_JOB_TIMEOUT_MS,
  DEFAULT_LOCK_DURATION_MS,
  DEFAULT_REMOVE_ON_COMPLETE,
  DEFAULT_REMOVE_ON_FAIL,
  DEFAULT_RETRY_ATTEMPTS,
  DEFAULT_RETRY_BACKOFF_DELAY_MS,
} from "./constants.js";

export type RedisConnectionOptions = {
  host: string;
  port: number;
  password?: string;
};

export type RateLimiterConfig = {
  max: number;
  duration: number;
};

export function getRedisConnectionOptions(): RedisConnectionOptions {
  const host = process.env.REDIS_HOST ?? "localhost";
  const port = Number.parseInt(process.env.REDIS_PORT ?? "6379", 10);
  const password = process.env.REDIS_PASSWORD;

  return password ? { host, port, password } : { host, port };
}

export function getRemoveOnCompleteCount(): number {
  const raw = process.env.BULLMQ_REMOVE_ON_COMPLETE;
  if (!raw) return DEFAULT_REMOVE_ON_COMPLETE;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? DEFAULT_REMOVE_ON_COMPLETE : parsed;
}

export function getRemoveOnFailCount(): number {
  const raw = process.env.BULLMQ_REMOVE_ON_FAIL;
  if (!raw) return DEFAULT_REMOVE_ON_FAIL;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? DEFAULT_REMOVE_ON_FAIL : parsed;
}

export function getLockDurationMs(): number {
  const raw = process.env.BULLMQ_LOCK_DURATION_MS;
  if (!raw) return DEFAULT_LOCK_DURATION_MS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? DEFAULT_LOCK_DURATION_MS : parsed;
}

export function getStalledIntervalMs(): number | undefined {
  const raw = process.env.BULLMQ_STALLED_INTERVAL_MS;
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function getMaxStalledCount(): number | undefined {
  const raw = process.env.BULLMQ_MAX_STALLED_COUNT;
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function getRateLimiterConfig(): RateLimiterConfig | undefined {
  const maxRaw = process.env.BULLMQ_RATE_LIMIT_MAX;
  const durationRaw = process.env.BULLMQ_RATE_LIMIT_DURATION_MS;

  if (!maxRaw || !durationRaw) return undefined;

  const max = Number.parseInt(maxRaw, 10);
  const duration = Number.parseInt(durationRaw, 10);

  if (Number.isNaN(max) || Number.isNaN(duration)) return undefined;

  return { max, duration };
}

export function getRetryAttempts(): number {
  const raw = process.env.BULLMQ_RETRY_ATTEMPTS;
  if (!raw) return DEFAULT_RETRY_ATTEMPTS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? DEFAULT_RETRY_ATTEMPTS : parsed;
}

export function getRetryBackoffType(): "exponential" | "fixed" {
  const raw = process.env.BULLMQ_RETRY_BACKOFF_TYPE;
  return raw === "fixed" ? "fixed" : "exponential";
}

export function getRetryBackoffDelay(): number {
  const raw = process.env.BULLMQ_RETRY_BACKOFF_DELAY_MS;
  if (!raw) return DEFAULT_RETRY_BACKOFF_DELAY_MS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? DEFAULT_RETRY_BACKOFF_DELAY_MS : parsed;
}

export function getJobTimeoutMs(): number {
  const raw = process.env.BULLMQ_JOB_TIMEOUT_MS;
  if (!raw) return DEFAULT_JOB_TIMEOUT_MS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? DEFAULT_JOB_TIMEOUT_MS : parsed;
}
