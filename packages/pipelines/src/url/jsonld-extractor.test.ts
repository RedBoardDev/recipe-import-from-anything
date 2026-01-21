import { describe, expect, it } from "vitest";
import { extractJsonLdNodesFromHtml, selectRecipeCandidate } from "./jsonld-extractor";

const wrapHtml = (jsonLd: string) => `<!doctype html><html><head><script type="application/ld+json">${jsonLd}</script></head><body></body></html>`;

describe("JSON-LD extractor", () => {
  it("supports @graph blocks", () => {
    const jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "BreadcrumbList" },
        {
          "@type": "Recipe",
          name: "Graph Recipe",
          recipeIngredient: ["Water"],
          recipeInstructions: ["Mix"]
        }
      ]
    });

    const nodes = extractJsonLdNodesFromHtml(wrapHtml(jsonLd));
    const recipe = selectRecipeCandidate(nodes);

    expect(recipe?.name).toBe("Graph Recipe");
  });

  it("supports array JSON-LD", () => {
    const jsonLd = JSON.stringify([
      { "@type": "Person", name: "Someone" },
      {
        "@type": "Recipe",
        name: "Array Recipe",
        recipeIngredient: ["Salt"],
        recipeInstructions: ["Cook"]
      }
    ]);

    const nodes = extractJsonLdNodesFromHtml(wrapHtml(jsonLd));
    const recipe = selectRecipeCandidate(nodes);

    expect(recipe?.name).toBe("Array Recipe");
  });

  it("picks the most plausible recipe", () => {
    const html = `<!doctype html><html><head>
      <script type="application/ld+json">${JSON.stringify({
        "@type": "Recipe",
        name: "Thin Recipe",
        recipeIngredient: ["Water"]
      })}</script>
      <script type="application/ld+json">${JSON.stringify({
        "@type": "Recipe",
        name: "Full Recipe",
        recipeIngredient: ["Sugar"],
        recipeInstructions: ["Stir"]
      })}</script>
      </head><body></body></html>`;

    const nodes = extractJsonLdNodesFromHtml(html);
    const recipe = selectRecipeCandidate(nodes);

    expect(recipe?.name).toBe("Full Recipe");
  });
});
