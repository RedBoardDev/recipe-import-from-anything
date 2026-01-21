import type { EvidenceBundle, ImportJob, ImportResult, SchemaOrgRecipe, SourceType } from "@ria/domain";
import type { Step, StepContext, StepRunOutput, WorkflowDefinition } from "@ria/application";
import type { Pipeline } from "../index";
import { extractJsonLdNodesFromHtml, selectRecipeCandidate } from "./jsonld-extractor";
import { extractRecipeIngredients, extractRecipeInstructions } from "./recipe-utils";
import { normalizeSchemaOrgRecipe } from "./normalize-recipe";
import { buildConfidenceReport } from "../shared/confidence";

interface FetchOutput {
  url: string;
  html: string;
  evidence: EvidenceBundle;
}

interface ExtractOutput {
  url: string;
  recipeNode: Record<string, unknown>;
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

const ensureUrl = (job: ImportJob): string => {
  const url = job.payload.url;
  if (typeof url !== "string" || url.trim().length === 0) {
    throw new Error("Missing URL payload");
  }

  return url;
};

class FetchHttpStep implements Step<ImportJob, FetchOutput> {
  id = "url.fetch.http";

  async run(job: ImportJob, ctx: StepContext): Promise<StepRunOutput<FetchOutput>> {
    const url = ensureUrl(job);
    const response = await ctx.fetchProvider.fetchHtml(url);

    const evidence: EvidenceBundle = {
      refs: [
        {
          id: "source-url",
          type: "html",
          uri: url,
          summary: "Source URL"
        }
      ],
      summary: "Fetched HTML"
    };

    let outputRef: string | undefined;
    if (job.options.debug) {
      outputRef = await ctx.artifactStore.put(
        `jobs/${job.id}/source.html`,
        response.body,
        "text/html"
      );

      evidence.refs.push({
        id: "source-html",
        type: "html",
        uri: outputRef,
        summary: "Fetched HTML"
      });
    }

    return {
      output: {
        url: response.url,
        html: response.body,
        evidence
      },
      outputRef,
      meta: {
        status: response.status,
        contentType: response.headers["content-type"]
      }
    };
  }
}

class ExtractJsonLdRecipeStep implements Step<FetchOutput, ExtractOutput> {
  id = "url.extract.jsonld.recipe";

  async run(input: FetchOutput, ctx: StepContext): Promise<StepRunOutput<ExtractOutput>> {
    const nodes = extractJsonLdNodesFromHtml(input.html);
    const candidate = selectRecipeCandidate(nodes);

    if (!candidate) {
      throw new Error("No JSON-LD recipe found");
    }

    let outputRef: string | undefined;
    const evidence = { ...input.evidence, refs: [...input.evidence.refs] };

    if (ctx.job.options.debug) {
      const jsonLd = JSON.stringify(candidate, null, 2);
      outputRef = await ctx.artifactStore.put(
        `jobs/${ctx.job.id}/recipe.jsonld`,
        jsonLd,
        "application/ld+json"
      );

      evidence.refs.push({
        id: "recipe-jsonld",
        type: "jsonld",
        uri: outputRef,
        summary: "Recipe JSON-LD"
      });
    }

    return {
      output: {
        url: input.url,
        recipeNode: candidate,
        evidence
      },
      outputRef,
      meta: {
        candidates: nodes.length,
        ingredientCount: extractRecipeIngredients(candidate).length,
        instructionCount: extractRecipeInstructions(candidate).length
      }
    };
  }
}

class NormalizeSchemaOrgStep implements Step<ExtractOutput, NormalizedOutput> {
  id = "url.normalize.schemaorg";

  async run(input: ExtractOutput): Promise<NormalizedOutput> {
    return {
      recipe: normalizeSchemaOrgRecipe(input.recipeNode),
      evidence: input.evidence
    };
  }
}

class ScoreConfidenceStep implements Step<NormalizedOutput, ConfidenceOutput> {
  id = "url.score.confidence";

  async run(input: NormalizedOutput): Promise<ConfidenceOutput> {
    return {
      recipe: input.recipe,
      confidence: buildConfidenceReport(input.recipe),
      evidence: input.evidence
    };
  }
}

class FinalizeResultStep implements Step<ConfidenceOutput, ImportResult> {
  id = "url.finalize-result";

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

export class UrlPipeline implements Pipeline<ImportResult> {
  constructor(
    public readonly sourceType: SourceType = "url",
    public readonly id: string = "url"
  ) {}

  createWorkflow(job: ImportJob): WorkflowDefinition<ImportJob, ImportResult> {
    return {
      id: this.id,
      steps: [
        new FetchHttpStep(),
        new ExtractJsonLdRecipeStep(),
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
