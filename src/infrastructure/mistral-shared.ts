const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export const isAbortError = (error: unknown): boolean => error instanceof Error && error.name === "AbortError";

export const isRetryableHttpStatus = (status: number): boolean => RETRYABLE_STATUS_CODES.has(status);

export const computeRetryDelayMs = (attempt: number, baseDelayMs: number): number => {
  const backoff = baseDelayMs * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(baseDelayMs / 2)));
  return backoff + jitter;
};

export const waitWithSignal = async (delayMs: number, signal: AbortSignal): Promise<void> => {
  if (delayMs <= 0) return;
  if (signal.aborted) {
    throw new Error("Aborted before retry delay elapsed");
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);

    const onAbort = (): void => {
      clearTimeout(timeoutId);
      signal.removeEventListener("abort", onAbort);
      reject(new Error("Aborted during retry delay"));
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
};

export const createAbortController = (externalSignal?: AbortSignal): AbortController => {
  const controller = new AbortController();

  if (!externalSignal) {
    return controller;
  }

  if (externalSignal.aborted) {
    controller.abort();
    return controller;
  }

  externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  return controller;
};

export const resolveEnvInt = (envVar: string, defaultValue: number, validate?: (v: number) => boolean): number => {
  const raw = process.env[envVar];
  if (!raw) return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return defaultValue;
  if (validate && !validate(parsed)) return defaultValue;
  return parsed;
};
