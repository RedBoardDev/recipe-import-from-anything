import { z } from "zod";
import {
  isRecord,
  normalizeAggregateRating,
  normalizeAuthor,
  normalizeEnumValue,
  normalizeEnumValues,
  normalizeImage,
  normalizeIngredientList,
  normalizeInstructions,
  normalizeMinutes,
  normalizeNutrition,
  normalizeRecipeType,
  normalizeRecipeYield,
  normalizeStringArray,
  toFiniteNumber,
  toNonEmptyString,
} from "./recipe-jsonld.normalizers.js";

const trimmedOptionalStringSchema = z.preprocess((value) => toNonEmptyString(value), z.string().optional());

const optionalNumberSchema = z.preprocess((value) => toFiniteNumber(value), z.number().optional());

const optionalNonNegativeIntegerSchema = z.preprocess((value) => {
  const parsed = toFiniteNumber(value);
  if (parsed === undefined || parsed < 0) {
    return undefined;
  }

  return Math.round(parsed);
}, z.number().int().min(0).optional());

const optionalPositiveIntegerSchema = z.preprocess((value) => {
  const parsed = toFiniteNumber(value);
  if (parsed === undefined || parsed <= 0) {
    return undefined;
  }

  return Math.max(1, Math.round(parsed));
}, z.number().int().min(1).optional());

export const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
export const BUDGETS = ["LOW", "MEDIUM", "HIGH"] as const;
export const RECIPE_ATTRIBUTES = ["QUICK", "EASY", "HEALTHY", "VEGETARIAN"] as const;
export const RECIPE_CATEGORIES = [
  "MAIN_COURSE",
  "APPETIZER",
  "SIDE_DISH",
  "DESSERT",
  "DRINK",
  "BREAKFAST",
  "SNACK",
  "SOUP",
  "SALAD",
  "SAUCE",
] as const;

export const DifficultySchema = z.enum(DIFFICULTIES);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const BudgetSchema = z.enum(BUDGETS);
export type Budget = z.infer<typeof BudgetSchema>;

export const RecipeAttributeSchema = z.enum(RECIPE_ATTRIBUTES);
export type RecipeAttribute = z.infer<typeof RecipeAttributeSchema>;

export const RecipeCategorySchema = z.enum(RECIPE_CATEGORIES);
export type RecipeCategory = z.infer<typeof RecipeCategorySchema>;

const normalizedDifficultySchema = z.preprocess(
  (value) => normalizeEnumValue(value, DIFFICULTIES),
  DifficultySchema.optional(),
);

const normalizedBudgetSchema = z.preprocess((value) => normalizeEnumValue(value, BUDGETS), BudgetSchema.optional());

const normalizedCategorySchema = z.preprocess(
  (value) => normalizeEnumValues(value, RECIPE_CATEGORIES),
  z.array(RecipeCategorySchema).optional(),
);

const normalizedAttributeSchema = z.preprocess(
  (value) => normalizeEnumValues(value, RECIPE_ATTRIBUTES),
  z.array(RecipeAttributeSchema).optional(),
);

export const RecipeIngredientSchema = z.object({
  name: z.string(),
  quantity: optionalNumberSchema,
  unit: trimmedOptionalStringSchema,
  note: trimmedOptionalStringSchema,
  optional: z.boolean().optional(),
  order: z.number().int().min(0),
  raw: trimmedOptionalStringSchema,
});

export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

const normalizedIngredientListSchema = z.preprocess(
  (value) => normalizeIngredientList(value),
  z.array(RecipeIngredientSchema).optional(),
);

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

const LEADING_YIELD_QUANTITY_PATTERN = /^(\d+(?:[.,]\d+)?)(?:\s+(.+))?$/;

const deriveServingsFromRecipeYield = (value: string | number | undefined): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.max(1, Math.round(value));
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const match = value.match(LEADING_YIELD_QUANTITY_PATTERN);
  if (!match) {
    return undefined;
  }

  const parsed = toFiniteNumber(match[1]);
  if (parsed === undefined || parsed <= 0) {
    return undefined;
  }

  return Math.max(1, Math.round(parsed));
};

const deriveYieldUnitLabel = (
  explicitValue: string | undefined,
  recipeYield: string | number | undefined,
): string | undefined => {
  if (explicitValue) {
    return explicitValue;
  }

  if (typeof recipeYield !== "string") {
    return undefined;
  }

  const match = recipeYield.match(LEADING_YIELD_QUANTITY_PATTERN);
  const normalizedRemainder = match?.[2] ? toNonEmptyString(match[2]) : undefined;

  return normalizedRemainder ?? recipeYield;
};

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
    prepTimeMin: optionalNonNegativeIntegerSchema,
    cookTimeMin: optionalNonNegativeIntegerSchema,
    totalTimeMin: optionalNonNegativeIntegerSchema,
    servings: optionalPositiveIntegerSchema,
    recipeYield: normalizedRecipeYieldSchema,
    yieldUnitLabel: trimmedOptionalStringSchema,
    difficulty: normalizedDifficultySchema,
    budget: normalizedBudgetSchema,
    categories: normalizedCategorySchema,
    attributes: normalizedAttributeSchema,
    recipeIngredient: normalizedStringArraySchema,
    ingredients: normalizedIngredientListSchema,
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
    const recipeIngredient = value.recipeIngredient;
    const ingredients = value.ingredients ?? normalizeIngredientList(recipeIngredient);

    const servings = value.servings ?? deriveServingsFromRecipeYield(value.recipeYield);
    const yieldUnitLabel = deriveYieldUnitLabel(value.yieldUnitLabel, value.recipeYield);

    const prepTimeMin = value.prepTimeMin ?? normalizeMinutes(value.prepTime);
    const cookTimeMin = value.cookTimeMin ?? normalizeMinutes(value.cookTime);
    const totalTimeMin =
      value.totalTimeMin ??
      normalizeMinutes(value.totalTime) ??
      (prepTimeMin !== undefined || cookTimeMin !== undefined ? (prepTimeMin ?? 0) + (cookTimeMin ?? 0) : undefined);

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
      ...(servings !== undefined ? { servings } : {}),
      ...(yieldUnitLabel ? { yieldUnitLabel } : {}),
      ...(prepTimeMin !== undefined ? { prepTimeMin } : {}),
      ...(cookTimeMin !== undefined ? { cookTimeMin } : {}),
      ...(totalTimeMin !== undefined ? { totalTimeMin } : {}),
      ...(value.difficulty ? { difficulty: value.difficulty } : {}),
      ...(value.budget ? { budget: value.budget } : {}),
      ...(value.categories ? { categories: value.categories } : {}),
      ...(value.attributes ? { attributes: value.attributes } : {}),
      ...(recipeIngredient ? { recipeIngredient } : {}),
      ...(ingredients ? { ingredients } : {}),
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

export const normalizeRecipeJsonLd = (value: unknown): RecipeJsonLd => {
  const parsed = RecipeJsonLdSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
};
