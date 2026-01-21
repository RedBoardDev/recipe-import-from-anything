import { SchemaOrgRecipeSchema } from "@ria/domain";
import type { SchemaOrgRecipe } from "@ria/domain";
import { extractRecipeIngredients, extractRecipeInstructions } from "./recipe-utils";

export const normalizeSchemaOrgRecipe = (node: Record<string, unknown>): SchemaOrgRecipe => {
  const name = typeof node.name === "string" ? node.name.trim() : "";
  const recipeIngredient = extractRecipeIngredients(node);
  const recipeInstructions = extractRecipeInstructions(node);
  const context = typeof node["@context"] === "string" ? node["@context"] : undefined;

  const recipe: SchemaOrgRecipe = {
    "@type": "Recipe",
    name,
    recipeIngredient,
    recipeInstructions,
    ...(context ? { "@context": context } : {})
  };

  return SchemaOrgRecipeSchema.parse(recipe);
};
