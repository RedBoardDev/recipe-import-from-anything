import { describe, expect, it } from "vitest";
import { SchemaOrgRecipeSchema } from "./schema-org-recipe";

describe("SchemaOrgRecipeSchema", () => {
  it("accepts a minimal valid recipe", () => {
    const result = SchemaOrgRecipeSchema.safeParse({
      "@type": "Recipe",
      name: "Pasta",
      recipeIngredient: ["Salt", "Pasta"],
      recipeInstructions: ["Boil", "Serve"]
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const result = SchemaOrgRecipeSchema.safeParse({
      "@type": "Recipe",
      name: "Pasta"
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid field types", () => {
    const result = SchemaOrgRecipeSchema.safeParse({
      "@type": "Recipe",
      name: "Pasta",
      recipeIngredient: "Salt",
      recipeInstructions: ["Boil"]
    });

    expect(result.success).toBe(false);
  });
});
