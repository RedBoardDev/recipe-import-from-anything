import type { RecipeJsonLd } from "@recipe/domain";

export const imageAnnotationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    "@context": { type: ["string", "null"] },
    "@type": {
      oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }, { type: "null" }],
    },
    name: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    author: {
      oneOf: [
        { type: "string" },
        {
          type: "object",
          additionalProperties: false,
          properties: {
            "@type": { type: ["string", "null"] },
            name: { type: ["string", "null"] },
          },
        },
        { type: "null" },
      ],
    },
    datePublished: { type: ["string", "null"] },
    prepTime: { type: ["string", "null"] },
    cookTime: { type: ["string", "null"] },
    totalTime: { type: ["string", "null"] },
    recipeYield: {
      oneOf: [{ type: "string" }, { type: "number" }, { type: "null" }],
    },
    recipeIngredient: {
      oneOf: [{ type: "array", items: { type: "string" } }, { type: "null" }],
    },
    instructions: {
      oneOf: [
        {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              "@type": { type: ["string", "null"] },
              text: { type: ["string", "null"] },
              name: { type: ["string", "null"] },
              url: { type: ["string", "null"] },
            },
          },
        },
        { type: "null" },
      ],
    },
    recipeInstructions: {
      oneOf: [
        {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              "@type": { type: ["string", "null"] },
              text: { type: ["string", "null"] },
              name: { type: ["string", "null"] },
              url: { type: ["string", "null"] },
            },
          },
        },
        { type: "null" },
      ],
    },
    nutrition: {
      type: ["object", "null"],
      additionalProperties: false,
      properties: {
        calories: { type: ["string", "null"] },
        proteinContent: { type: ["string", "null"] },
        fatContent: { type: ["string", "null"] },
        carbohydrateContent: { type: ["string", "null"] },
        fiberContent: { type: ["string", "null"] },
        sodiumContent: { type: ["string", "null"] },
      },
    },
    image: {
      oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }, { type: "null" }],
    },
    keywords: { type: ["string", "null"] },
    cuisine: { type: ["string", "null"] },
    aggregateRating: {
      type: ["object", "null"],
      additionalProperties: false,
      properties: {
        ratingValue: { type: ["number", "null"] },
        reviewCount: { type: ["number", "null"] },
      },
    },
  },
} satisfies Record<string, unknown>;

export type ImageAnnotation = Partial<RecipeJsonLd> & {
  "@context"?: string | null;
  "@type"?: string | null;
  recipeInstructions?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export const parseImageAnnotation = (annotation: string | undefined): ImageAnnotation | null => {
  if (!annotation) return null;

  try {
    const parsed = JSON.parse(annotation) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }

    const normalizedType =
      Array.isArray(parsed["@type"]) && parsed["@type"].length > 0 && typeof parsed["@type"][0] === "string"
        ? parsed["@type"][0]
        : parsed["@type"];

    const normalizedInstructions = parsed.instructions !== undefined ? parsed.instructions : parsed.recipeInstructions;

    return {
      ...parsed,
      ...(normalizedType !== undefined ? { "@type": normalizedType } : {}),
      ...(normalizedInstructions !== undefined ? { instructions: normalizedInstructions } : {}),
    } as ImageAnnotation;
  } catch {
    return null;
  }
};
