import type { CanonicalRecipe, TextExtractionResult } from "@recipe/domain";
import { CanonicalRecipeSchema, canonicalRecipeResponseSchema } from "@recipe/domain";
import type { FormatterDeps } from "@recipe/pipeline-contracts";

const DEFAULT_LLM_MODEL = "mistral-large-latest";

/**
 * Service for formatting extracted recipe text into a CanonicalRecipe using LLM.
 *
 * This service handles:
 * - Retry logic with exponential backoff (3 attempts)
 * - LLM prompting for structured recipe extraction
 * - Zod schema validation of the output
 * - Error handling and logging
 */
export class RecipeFormatterService {
  private readonly MAX_RETRIES = 3;

  /**
   * Convertit un TextExtractionResult en CanonicalRecipe via LLM
   * @throws Error si les 3 essais échouent
   */
  async format(
    input: TextExtractionResult,
    deps: FormatterDeps,
    reporter: {
      setStatus: (status: "formatting") => void;
      checkpoint: (checkpoint: "formatting_started") => void;
      log: (message: string) => void;
    },
  ): Promise<CanonicalRecipe> {
    reporter.setStatus("formatting");
    reporter.checkpoint("formatting_started");

    const { rawText, metadata } = input;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        reporter.log(`Recipe formatting attempt ${attempt}/${this.MAX_RETRIES}`);

        const response = await this.llmComplete(deps, rawText, metadata.sourceType);
        return this.parseAndValidate(response.content);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        deps.logger.warn(`Recipe formatting attempt ${attempt} failed`, {
          error: errorMessage,
          sourceType: metadata.sourceType,
          jobId: deps.context.jobId,
        });

        if (attempt === this.MAX_RETRIES) {
          throw new Error(`Recipe formatting failed after ${this.MAX_RETRIES} attempts: ${errorMessage}`);
        }
      }
    }

    // Unreachable: should have thrown after MAX_RETRIES
    throw new Error("Recipe formatting failed: unreachable code");
  }

  private async llmComplete(deps: FormatterDeps, rawText: string, sourceType: string): Promise<{ content: string }> {
    return deps.llm.complete(
      {
        model: process.env.LLM_MODEL || DEFAULT_LLM_MODEL,
        temperature: 0,
        messages: [
          { role: "system", content: this.buildSystemPrompt() },
          { role: "user", content: this.buildUserPrompt(rawText, sourceType) },
        ],
        responseFormat: {
          type: "json_schema",
          json_schema: canonicalRecipeResponseSchema,
        },
      },
      { signal: deps.signal },
    );
  }

  private buildSystemPrompt(): string {
    return `You are a recipe extraction expert. Extract structured recipe data from the provided text.

Return a valid JSON object following the canonical recipe schema.

IMPORTANT RULES:
- Be accurate and preserve ALL ingredients and instructions from the original text
- If information is missing or unclear, omit the field rather than inventing values
- The 'name' field is REQUIRED - if no recipe name is present, use "Untitled Recipe"
- Maintain the exact order of ingredients and instructions from the source
- Parse quantities and units accurately (e.g., "2 cups", "1/2 tsp", "250g")
- Include approximate times in minutes when possible
- Always include the 'order' field for each ingredient and instruction (1-based index)

The canonical recipe format includes:
- name (required): Recipe title
- description (optional): Brief description of the dish
- servings (optional): Number of servings or yield
- ingredients: array of { name, quantity?, unit?, order, raw?, note?, optional? }
  - order is REQUIRED for each ingredient (1-based index)
- instructions: array of { text, order, durationMin? }
  - order is REQUIRED for each instruction (1-based index)
- prepTimeMin, cookTimeMin, totalTimeMin (optional): In minutes
- difficulty (optional): "EASY" | "MEDIUM" | "HARD"
- budget (optional): "LOW" | "MEDIUM" | "HIGH"
- categories, attributes, keywords, cuisine (optional arrays)
- nutrition (optional object with calories, proteinContent, etc.)
- author (optional object with name)
- image (optional string or array of strings)`;
  }

  private buildUserPrompt(rawText: string, sourceType: string): string {
    return `Extract the recipe from the following ${sourceType} content:

${rawText}`;
  }

  private parseAndValidate(content: string): CanonicalRecipe {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON response from LLM: ${error instanceof Error ? error.message : String(error)}`);
    }

    const validated = CanonicalRecipeSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(`Invalid canonical recipe: ${JSON.stringify(validated.error.issues)}`);
    }

    return validated.data;
  }
}
