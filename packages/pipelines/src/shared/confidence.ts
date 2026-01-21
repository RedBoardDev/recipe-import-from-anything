import type { SchemaOrgRecipe } from "@ria/domain";

export const buildConfidenceReport = (recipe: SchemaOrgRecipe) => {
  const nameScore = recipe.name.trim().length > 0 ? 1 : 0;
  const ingredientScore = recipe.recipeIngredient.length > 0 ? 1 : 0;
  const instructionScore = recipe.recipeInstructions.length > 0 ? 1 : 0;
  const overall = Number(
    ((nameScore + ingredientScore + instructionScore) / 3).toFixed(2)
  );

  return {
    overall,
    fields: {
      name: nameScore,
      recipeIngredient: ingredientScore,
      recipeInstructions: instructionScore
    }
  };
};
