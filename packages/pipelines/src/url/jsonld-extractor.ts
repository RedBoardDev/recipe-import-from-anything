import { scoreRecipeCandidate } from "./recipe-utils";

const SCRIPT_REGEX =
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const normalizeType = (value: string): string => {
  const trimmed = value.trim();
  const last = trimmed.split(/[/:]/).pop();
  return (last ?? trimmed).toLowerCase();
};

const getTypeValues = (value: unknown): string[] => {
  if (typeof value === "string") {
    return [normalizeType(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => (typeof item === "string" ? [normalizeType(item)] : []));
  }

  return [];
};

const isRecipeNode = (node: Record<string, unknown>): boolean =>
  getTypeValues(node["@type"]).includes("recipe");

const parseJsonLdBlock = (raw: string): unknown | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};

const flattenJsonLdValue = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenJsonLdValue(item));
  }

  if (isRecord(value)) {
    const nodes: Record<string, unknown>[] = [value];
    const graph = value["@graph"];
    if (Array.isArray(graph)) {
      for (const entry of graph) {
        if (isRecord(entry)) {
          nodes.push(entry);
        }
      }
    }

    return nodes;
  }

  return [];
};

export const extractJsonLdNodesFromHtml = (html: string): Record<string, unknown>[] => {
  const nodes: Record<string, unknown>[] = [];
  const matches = html.matchAll(SCRIPT_REGEX);

  for (const match of matches) {
    const raw = match[1];
    const parsed = parseJsonLdBlock(raw ?? "");
    if (!parsed) {
      continue;
    }

    nodes.push(...flattenJsonLdValue(parsed));
  }

  return nodes;
};

export const selectRecipeCandidate = (
  nodes: Record<string, unknown>[]
): Record<string, unknown> | null => {
  const candidates = nodes.filter(isRecipeNode);
  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((best, candidate) =>
    scoreRecipeCandidate(candidate) > scoreRecipeCandidate(best) ? candidate : best
  );
};
