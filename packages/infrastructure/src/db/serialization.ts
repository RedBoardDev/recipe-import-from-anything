export const isRecord = (
  value: unknown
): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const asRecord = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : {};

import type { JsonValue } from "./types";

export const asArray = <T>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

export const toJsonValue = (
  value: unknown,
  fallback: JsonValue = null
): JsonValue => {
  if (value === undefined) {
    return fallback;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    if (fallback === null || fallback === undefined) {
      return null;
    }

    if (
      typeof fallback === "string" ||
      typeof fallback === "number" ||
      typeof fallback === "boolean"
    ) {
      return fallback;
    }

    try {
      return JSON.stringify(fallback);
    } catch {
      return null;
    }
  }
};
