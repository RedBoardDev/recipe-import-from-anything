export function formatSuccess<T>(data: T) {
  return {
    success: true as const,
    data,
  };
}

export type ApiErrorArgs = Record<string, string | number | boolean>;

export function formatError(code: string, options?: { details?: unknown; args?: ApiErrorArgs }) {
  const details = options?.details;
  const args = options?.args;

  return {
    success: false as const,
    error: {
      code,
      ...(args !== undefined && { args }),
      ...(details !== undefined && { details }),
    },
  };
}
