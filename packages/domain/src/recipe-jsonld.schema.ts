import { z } from "zod";
import {
  isRecord,
  normalizeAggregateRating,
  normalizeAuthor,
  normalizeImage,
  normalizeInstructions,
  normalizeNutrition,
  normalizeRecipeType,
  normalizeRecipeYield,
  normalizeStringArray,
  toNonEmptyString,
} from "./recipe-jsonld.normalizers.js";

const trimmedOptionalStringSchema = z.preprocess((value) => toNonEmptyString(value), z.string().optional());

export const RecipeInstructionSchema = z.object({
  "@type": z.enum(["HowToStep", "HowToSection"]).optional(),
  text: z.string().optional(),
  name: z.string().optional(),
  url: z.string().optional(),
});

export type RecipeInstruction = z.infer<typeof RecipeInstructionSchema>;

const normalizedInstructionsSchema = z.preprocess(
  (value) => normalizeInstructions(value),
  z.array(RecipeInstructionSchema).optional(),
);

export const RecipeNutritionSchema = z.object({
  calories: z.string().optional(),
  proteinContent: z.string().optional(),
  fatContent: z.string().optional(),
  carbohydrateContent: z.string().optional(),
  fiberContent: z.string().optional(),
  sodiumContent: z.string().optional(),
});

export type RecipeNutrition = z.infer<typeof RecipeNutritionSchema>;

const normalizedNutritionSchema = z.preprocess((value) => normalizeNutrition(value), RecipeNutritionSchema.optional());

export const RecipeAuthorSchema = z.object({
  "@type": z.enum(["Person", "Organization"]).optional(),
  name: z.string().optional(),
});

export type RecipeAuthor = z.infer<typeof RecipeAuthorSchema>;

const normalizedAuthorSchema = z.preprocess((value) => normalizeAuthor(value), RecipeAuthorSchema.optional());

export const RecipeAggregateRatingSchema = z.object({
  ratingValue: z.number().optional(),
  reviewCount: z.number().optional(),
});

export type RecipeAggregateRating = z.infer<typeof RecipeAggregateRatingSchema>;

const normalizedAggregateRatingSchema = z.preprocess(
  (value) => normalizeAggregateRating(value),
  RecipeAggregateRatingSchema.optional(),
);

const normalizedRecipeTypeSchema = z.preprocess((value) => normalizeRecipeType(value), z.literal("Recipe").optional());

const normalizedRecipeYieldSchema = z.preprocess(
  (value) => normalizeRecipeYield(value),
  z.union([z.string(), z.number()]).optional(),
);

const normalizedStringArraySchema = z.preprocess(
  (value) => normalizeStringArray(value),
  z.array(z.string()).optional(),
);

const normalizedImageSchema = z.preprocess(
  (value) => normalizeImage(value),
  z.union([z.string(), z.array(z.string())]).optional(),
);

const recipeJsonLdInputSchema = z
  .object({
    "@context": trimmedOptionalStringSchema,
    "@type": normalizedRecipeTypeSchema,
    name: trimmedOptionalStringSchema,
    description: trimmedOptionalStringSchema,
    author: normalizedAuthorSchema,
    datePublished: trimmedOptionalStringSchema,
    prepTime: trimmedOptionalStringSchema,
    cookTime: trimmedOptionalStringSchema,
    totalTime: trimmedOptionalStringSchema,
    recipeYield: normalizedRecipeYieldSchema,
    recipeIngredient: normalizedStringArraySchema,
    instructions: normalizedInstructionsSchema,
    recipeInstructions: normalizedInstructionsSchema,
    nutrition: normalizedNutritionSchema,
    image: normalizedImageSchema,
    keywords: trimmedOptionalStringSchema,
    cuisine: trimmedOptionalStringSchema,
    aggregateRating: normalizedAggregateRatingSchema,
  })
  .passthrough();

export const RecipeJsonLdSchema = z.preprocess(
  (value) => (isRecord(value) ? value : {}),
  recipeJsonLdInputSchema.transform((value) => {
    const instructions = value.instructions ?? value.recipeInstructions;

    return {
      ...(value["@context"] ? { "@context": value["@context"] } : {}),
      ...(value["@type"] ? { "@type": value["@type"] } : {}),
      ...(value.name ? { name: value.name } : {}),
      ...(value.description ? { description: value.description } : {}),
      ...(value.author ? { author: value.author } : {}),
      ...(value.datePublished ? { datePublished: value.datePublished } : {}),
      ...(value.prepTime ? { prepTime: value.prepTime } : {}),
      ...(value.cookTime ? { cookTime: value.cookTime } : {}),
      ...(value.totalTime ? { totalTime: value.totalTime } : {}),
      ...(value.recipeYield !== undefined ? { recipeYield: value.recipeYield } : {}),
      ...(value.recipeIngredient ? { recipeIngredient: value.recipeIngredient } : {}),
      ...(instructions ? { instructions } : {}),
      ...(value.nutrition ? { nutrition: value.nutrition } : {}),
      ...(value.image ? { image: value.image } : {}),
      ...(value.keywords ? { keywords: value.keywords } : {}),
      ...(value.cuisine ? { cuisine: value.cuisine } : {}),
      ...(value.aggregateRating ? { aggregateRating: value.aggregateRating } : {}),
    };
  }),
);

export type RecipeJsonLd = z.output<typeof RecipeJsonLdSchema>;
export type RecipeJsonLdSchemaInput = z.input<typeof RecipeJsonLdSchema>;
export type RecipeJsonLdSchemaOutput = z.output<typeof RecipeJsonLdSchema>;
