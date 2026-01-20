import { z } from "zod";

const RecipeInstructionsSchema = z.array(z.string().min(1));
const RecipeIngredientsSchema = z.array(z.string().min(1));

export const SchemaOrgRecipeSchema = z
  .object({
    "@context": z.string().optional(),
    "@type": z.literal("Recipe"),
    name: z.string().min(1),
    recipeIngredient: RecipeIngredientsSchema,
    recipeInstructions: RecipeInstructionsSchema
  })
  .passthrough();

export type SchemaOrgRecipe = z.infer<typeof SchemaOrgRecipeSchema>;
