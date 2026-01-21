import type {
  EvidenceBundle,
  ImportJob,
  ImportResult,
  SchemaOrgRecipe,
  SourceType
} from "@ria/domain";
import { SchemaOrgRecipeSchema } from "@ria/domain";
import type { Step, StepContext, StepRunOutput, WorkflowDefinition } from "@ria/application";
import type { Pipeline } from "../index";
import { buildConfidenceReport } from "../shared/confidence";
import { parseTextRecipe } from "./text-heuristics";

interface ParsedOutput {
  recipe: {
    title?: string;
    ingredients: string[];
    instructions: string[];
  };
  evidence: EvidenceBundle;
}

interface NormalizedOutput {
  recipe: SchemaOrgRecipe;
  evidence: EvidenceBundle;
}

interface ConfidenceOutput {
  recipe: SchemaOrgRecipe;
  confidence: ReturnType<typeof buildConfidenceReport>;
  evidence: EvidenceBundle;
}

const nowIso = (): string => new Date().toISOString();

const ensureText = (job: ImportJob): string => {
  const text = job.payload.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("Missing text payload");
  }

  return text;
};

class ParseHeuristicsStep implements Step<ImportJob, ParsedOutput> {
  id = "text.parse.heuristics";

  async run(job: ImportJob, ctx: StepContext): Promise<StepRunOutput<ParsedOutput>> {
    const text = ensureText(job);
    const parsed = parseTextRecipe(text);

    const evidence: EvidenceBundle = {
      refs: [],
      summary: "Parsed text input"
    };

    let outputRef: string | undefined;
    if (job.options.debug) {
      outputRef = await ctx.artifactStore.put(
        `jobs/${job.id}/source.txt`,
        text,
        "text/plain"
      );

      evidence.refs.push({
        id: "source-text",
        type: "text",
        uri: outputRef,
        summary: "Source text"
      });
    }

    return {
      output: {
        recipe: parsed,
        evidence
      },
      outputRef,
      meta: {
        ingredientCount: parsed.ingredients.length,
        instructionCount: parsed.instructions.length
      }
    };
  }
}

class NormalizeSchemaOrgStep implements Step<ParsedOutput, NormalizedOutput> {
  id = "text.normalize.schemaorg";

  async run(input: ParsedOutput): Promise<NormalizedOutput> {
    const title = input.recipe.title?.trim() || "Untitled Recipe";
    const recipeIngredient = input.recipe.ingredients.map((item) => item.trim()).filter(Boolean);
    const recipeInstructions = input.recipe.instructions.map((item) => item.trim()).filter(Boolean);

    if (recipeIngredient.length === 0 || recipeInstructions.length === 0) {
      throw new Error("Missing ingredients or instructions in text input");
    }

    const recipe: SchemaOrgRecipe = {
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: title,
      recipeIngredient,
      recipeInstructions
    };

    return {
      recipe: SchemaOrgRecipeSchema.parse(recipe),
      evidence: input.evidence
    };
  }
}

class ScoreConfidenceStep implements Step<NormalizedOutput, ConfidenceOutput> {
  id = "text.score.confidence";

  async run(input: NormalizedOutput): Promise<ConfidenceOutput> {
    return {
      recipe: input.recipe,
      confidence: buildConfidenceReport(input.recipe),
      evidence: input.evidence
    };
  }
}

class FinalizeResultStep implements Step<ConfidenceOutput, ImportResult> {
  id = "text.finalize-result";

  constructor(private readonly job: ImportJob, private readonly pipelineId: string) {}

  async run(input: ConfidenceOutput): Promise<ImportResult> {
    const now = nowIso();

    return {
      recipe: input.recipe,
      confidence: input.confidence,
      evidence: input.evidence,
      warnings: [],
      errors: [],
      meta: {
        pipelineId: this.pipelineId,
        steps: [],
        llmPolicy: this.job.options.llmPolicy,
        debug: this.job.options.debug,
        startedAt: now,
        endedAt: now
      }
    };
  }
}

export class TextPipeline implements Pipeline<ImportResult> {
  constructor(
    public readonly sourceType: SourceType = "text",
    public readonly id: string = "text"
  ) {}

  createWorkflow(job: ImportJob): WorkflowDefinition<ImportJob, ImportResult> {
    return {
      id: this.id,
      steps: [
        new ParseHeuristicsStep(),
        new NormalizeSchemaOrgStep(),
        new ScoreConfidenceStep(),
        new FinalizeResultStep(job, this.id)
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
