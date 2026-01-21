import { describe, expect, it } from "vitest";
import { parseTextRecipe } from "./text-heuristics";

describe("text heuristics parser", () => {
  it("parses headings and bullets", () => {
    const input = `Simple Pancakes\nIngredients:\n- 1 cup flour\n- 1 egg\nInstructions:\n1. Mix ingredients.\n2. Cook on skillet.`;

    const parsed = parseTextRecipe(input);

    expect(parsed.title).toBe("Simple Pancakes");
    expect(parsed.ingredients).toEqual(["1 cup flour", "1 egg"]);
    expect(parsed.instructions).toEqual(["Mix ingredients.", "Cook on skillet."]);
  });

  it("parses Steps heading and numeric lines", () => {
    const input = `Title\nIngredients:\n- Water\nSteps:\n1) Boil water\n2) Serve`;

    const parsed = parseTextRecipe(input);

    expect(parsed.instructions).toEqual(["Boil water", "Serve"]);
  });

  it("uses fallback when headings are missing", () => {
    const input = `Quick Snack\n1 apple\n2 slices bread\n1) Slice apple\n2) Assemble`;

    const parsed = parseTextRecipe(input);

    expect(parsed.title).toBe("Quick Snack");
    expect(parsed.ingredients.length).toBeGreaterThan(0);
    expect(parsed.instructions.length).toBeGreaterThan(0);
  });
});
