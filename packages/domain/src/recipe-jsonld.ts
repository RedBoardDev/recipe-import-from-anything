import type { RecipeJsonLd } from "./recipe-jsonld.schema.js";
import { RecipeJsonLdSchema } from "./recipe-jsonld.schema.js";

export {
  type RecipeAggregateRating,
  RecipeAggregateRatingSchema,
  type RecipeAuthor,
  RecipeAuthorSchema,
  type RecipeInstruction,
  RecipeInstructionSchema,
  type RecipeJsonLd,
  RecipeJsonLdSchema,
  type RecipeJsonLdSchemaInput,
  type RecipeJsonLdSchemaOutput,
  type RecipeNutrition,
  RecipeNutritionSchema,
} from "./recipe-jsonld.schema.js";

export const normalizeRecipeJsonLd = (value: unknown): RecipeJsonLd => {
  const parsed = RecipeJsonLdSchema.safeParse(value);
  if (!parsed.success) {
    return {};
  }
  return parsed.data;
};
