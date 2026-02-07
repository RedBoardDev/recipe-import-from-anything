import type { FetchClient, FetchResult } from "@recipe/pipeline-contracts";
import type { NetworkPolicy } from "../core/registry/types.js";

const DEFAULT_TIMEOUT_MS = 30_000;

const isHostAllowed = (url: string, policy?: NetworkPolicy): boolean => {
  if (!policy) return false;
  if (policy.allowedHosts.includes("*")) return true;
  try {
    const { hostname } = new URL(url);
    return policy.allowedHosts.some((allowed) => allowed === hostname);
  } catch {
    return false;
  }
};

const runFetch = async (
  url: string,
  options?: Readonly<{ signal?: AbortSignal; headers?: Record<string, string> }>,
): Promise<FetchResult> => {
  const controller = new AbortController();
  const abortSignal = options?.signal ?? controller.signal;

  if (options?.signal) {
    options.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: abortSignal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RecipeImport/1.0)",
        Accept: "text/html,application/xhtml+xml",
        ...(options?.headers ?? {}),
      },
    });

    clearTimeout(timeout);
    const html = await response.text();

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return { html, status: response.status, headers };
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Fetch timeout");
    }
    throw error;
  }
};

export const nodeFetchProvider: FetchClient = {
  fetch: (url, options) => runFetch(url, options),
};

export const createFetchClient = (policy?: NetworkPolicy): FetchClient => ({
  fetch: async (url, options) => {
    if (!isHostAllowed(url, policy)) {
      throw new Error(`Network access denied for host: ${url}`);
    }
    return runFetch(url, options);
  },
});
