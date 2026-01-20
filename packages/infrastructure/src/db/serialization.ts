export const isRecord = (
  value: unknown
): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const asRecord = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : {};

import type { JsonValue } from "./types";

export const asArray = <T>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

export const toJsonValue = (value: unknown): JsonValue => value as JsonValue;
