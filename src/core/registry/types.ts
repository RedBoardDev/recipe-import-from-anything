export type NetworkPolicy = Readonly<{
  mode: "allowlist";
  allowedHosts: readonly string[];
}>;

export type PipelineConfig = Readonly<{
  pipelineId: string;
  metaEntry: string;
  runtimeEntry: string;
  network?: NetworkPolicy;
}>;
