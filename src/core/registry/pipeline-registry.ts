import type { PipelineMeta, PipelineRuntime } from "@recipe/pipeline-contracts";
import { pipelineConfigs } from "../../config/pipelines.config.js";
import type { PipelineConfig } from "./types.js";

type MetaModule = Readonly<{ meta?: unknown }>;
type RuntimeModule = Readonly<{ runtime?: unknown }>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isPipelineMeta = (value: unknown): value is PipelineMeta => {
  if (!isRecord(value)) return false;
  return (
    typeof value.pipelineId === "string" &&
    typeof value.title === "string" &&
    Array.isArray(value.steps) &&
    isRecord(value.inputSchema) &&
    typeof (value.inputSchema as { safeParse?: unknown }).safeParse === "function"
  );
};

const isPipelineRuntime = (value: unknown): value is PipelineRuntime<unknown> => {
  if (!isRecord(value)) return false;
  return typeof value.execute === "function";
};

export class PipelineRegistry {
  private readonly configs: Map<string, PipelineConfig>;
  private readonly metaCache = new Map<string, PipelineMeta>();
  private readonly runtimeCache = new Map<string, PipelineRuntime<unknown>>();

  constructor(configs: readonly PipelineConfig[] = pipelineConfigs) {
    this.configs = new Map(configs.map((config) => [config.pipelineId, config]));
  }

  list(): PipelineConfig[] {
    return [...this.configs.values()];
  }

  getConfig(pipelineId: string): PipelineConfig | null {
    return this.configs.get(pipelineId) ?? null;
  }

  async getMeta(pipelineId: string): Promise<PipelineMeta> {
    const cached = this.metaCache.get(pipelineId);
    if (cached) return cached;

    const config = this.getConfig(pipelineId);
    if (!config) {
      throw new Error(`Pipeline not registered: ${pipelineId}`);
    }

    const module = (await import(config.metaEntry)) as MetaModule;
    if (!module.meta || !isPipelineMeta(module.meta)) {
      throw new Error(`Invalid meta export for pipeline: ${pipelineId}`);
    }

    if (module.meta.pipelineId !== pipelineId) {
      throw new Error(`Pipeline meta mismatch for ${pipelineId}`);
    }

    this.metaCache.set(pipelineId, module.meta);
    return module.meta;
  }

  async getRuntime(pipelineId: string): Promise<PipelineRuntime<unknown>> {
    const cached = this.runtimeCache.get(pipelineId);
    if (cached) return cached;

    const config = this.getConfig(pipelineId);
    if (!config) {
      throw new Error(`Pipeline not registered: ${pipelineId}`);
    }

    const module = (await import(config.runtimeEntry)) as RuntimeModule;
    if (!module.runtime || !isPipelineRuntime(module.runtime)) {
      throw new Error(`Invalid runtime export for pipeline: ${pipelineId}`);
    }

    this.runtimeCache.set(pipelineId, module.runtime);
    return module.runtime;
  }
}
