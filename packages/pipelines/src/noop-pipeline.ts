import type { ImportJob, ImportResult, SchemaOrgRecipe, SourceType } from "@ria/domain";
import type { Step, WorkflowDefinition } from "@ria/application";
import type { Pipeline } from "./index";

interface RecipeWithConfidence {
  recipe: SchemaOrgRecipe;
  confidence: {
    overall: number;
    fields: Record<string, number>;
  };
}

class BuildRecipeBaseStep implements Step<ImportJob, SchemaOrgRecipe> {
  id = "noop.build-recipe-base";

  async run(_job: ImportJob): Promise<SchemaOrgRecipe> {
    return {
      "@type": "Recipe",
      name: "Noop Recipe",
      recipeIngredient: ["Water"],
      recipeInstructions: ["Do nothing"]
    };
  }
}

class ScoreConfidenceStep implements Step<SchemaOrgRecipe, RecipeWithConfidence> {
  id = "noop.score-confidence";

  async run(recipe: SchemaOrgRecipe): Promise<RecipeWithConfidence> {
    return {
      recipe,
      confidence: {
        overall: 0.1,
        fields: {
          name: 0.1
        }
      }
    };
  }
}

class FinalizeResultStep implements Step<RecipeWithConfidence, ImportResult> {
  id = "noop.finalize-result";

  constructor(private readonly job: ImportJob) {}

  async run(input: RecipeWithConfidence): Promise<ImportResult> {
    const now = new Date().toISOString();

    return {
      recipe: input.recipe,
      confidence: input.confidence,
      evidence: {
        refs: [],
        summary: "noop"
      },
      warnings: [],
      errors: [],
      meta: {
        pipelineId: "noop",
        steps: [],
        llmPolicy: this.job.options.llmPolicy,
        debug: this.job.options.debug,
        startedAt: now,
        endedAt: now
      }
    };
  }
}

export class NoopPipeline implements Pipeline<ImportResult> {
  constructor(
    public readonly sourceType: SourceType = "url",
    public readonly id: string = "noop"
  ) {}

  createWorkflow(job: ImportJob): WorkflowDefinition<ImportJob, ImportResult> {
    return {
      id: this.id,
      steps: [
        new BuildRecipeBaseStep(),
        new ScoreConfidenceStep(),
        new FinalizeResultStep(job)
      ],
      initialInput: job,
      finalize: (output, _ctx, stepRuns) => ({
        ...output,
        meta: {
          ...output.meta,
          pipelineId: this.id,
          steps: stepRuns.map((run) => ({
            id: run.stepId,
            status: run.status === "FAILED" ? "FAILED" : "SUCCEEDED",
            durationMs: run.durationMs ?? 0
          }))
        }
      })
    };
  }
}
