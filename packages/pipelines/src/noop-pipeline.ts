import type { ImportJob, ImportResult, SourceType } from "@ria/domain";
import type { Pipeline, PipelineContext } from "./index";

export class NoopPipeline implements Pipeline {
  constructor(
    public readonly sourceType: SourceType = "url",
    public readonly id: string = "noop"
  ) {}

  async run(_job: ImportJob, _ctx: PipelineContext): Promise<ImportResult> {
    const startedAt = new Date().toISOString();
    const endedAt = new Date().toISOString();

    return {
      recipe: {
        "@type": "Recipe",
        name: "Noop Recipe",
        recipeIngredient: ["Water"],
        recipeInstructions: ["Do nothing"]
      },
      confidence: {
        overall: 0.1,
        fields: {
          name: 0.1
        }
      },
      evidence: {
        refs: [],
        summary: "noop"
      },
      warnings: [],
      errors: [],
      meta: {
        pipelineId: this.id,
        steps: [],
        llmPolicy: "never",
        debug: false,
        startedAt,
        endedAt
      }
    };
  }
}
