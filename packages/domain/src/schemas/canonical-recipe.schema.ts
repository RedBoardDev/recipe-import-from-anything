import { z } from "zod";
import {
  isRecord,
  normalizeEnumValue,
  normalizeEnumValues,
  normalizeImage,
  normalizeStringList,
  toFiniteNumber,
  toNonEmptyString,
} from "./recipe-jsonld.normalizers.js";
import { BUDGETS, DIFFICULTIES, RECIPE_ATTRIBUTES, RECIPE_CATEGORIES } from "./recipe-jsonld.schema.js";

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

export const CanonicalIngredientSchema = z.object({
  name: z.string().min(1),
  quantity: optionalNumberSchema,
  unit: trimmedOptionalStringSchema,
  note: trimmedOptionalStringSchema,
  optional: z.boolean().optional(),
  order: z.number().int().min(0),
  raw: trimmedOptionalStringSchema,
});

export type CanonicalIngredient = z.infer<typeof CanonicalIngredientSchema>;

const normalizeIngredientList = (value: unknown): CanonicalIngredient[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value.flatMap((entry, index): CanonicalIngredient[] => {
    if (typeof entry === "string") {
      const raw = toNonEmptyString(entry);
      if (!raw) {
        return [];
      }

      return [{ name: raw, order: index, raw }];
    }

    if (!isRecord(entry)) {
      return [];
    }

    const raw =
      toNonEmptyString(entry.raw) ??
      toNonEmptyString(entry.line) ??
      toNonEmptyString(entry.text) ??
      toNonEmptyString(entry.ingredient);
    const name =
      toNonEmptyString(entry.name) ??
      toNonEmptyString(entry.ingredient) ??
      toNonEmptyString(entry.line) ??
      toNonEmptyString(entry.text) ??
      raw;

    if (!name) {
      return [];
    }

    const quantity = toFiniteNumber(entry.quantity ?? entry.amount);
    const unit = toNonEmptyString(entry.unit);
    const note = toNonEmptyString(entry.note);
    const order = toFiniteNumber(entry.order ?? entry.index);

    return [
      {
        name,
        ...(quantity !== undefined ? { quantity } : {}),
        ...(unit ? { unit } : {}),
        ...(note ? { note } : {}),
        ...(typeof entry.optional === "boolean" ? { optional: entry.optional } : {}),
        order: order !== undefined && order >= 0 ? Math.round(order) : index,
        ...(raw ? { raw } : {}),
      },
    ];
  });

  return normalized.length > 0 ? normalized : undefined;
};

const normalizedIngredientListSchema = z.preprocess(
  (value) => normalizeIngredientList(value),
  z.array(CanonicalIngredientSchema).optional(),
);

export const CanonicalInstructionSchema = z.object({
  text: z.string().min(1),
  order: z.number().int().min(0),
  durationMin: optionalNonNegativeIntegerSchema,
});

export type CanonicalInstruction = z.infer<typeof CanonicalInstructionSchema>;

const normalizeInstructionList = (value: unknown): CanonicalInstruction[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value.flatMap((entry, index): CanonicalInstruction[] => {
    if (typeof entry === "string") {
      const text = toNonEmptyString(entry);
      return text ? [{ text, order: index }] : [];
    }

    if (!isRecord(entry)) {
      return [];
    }

    const text = toNonEmptyString(entry.text) ?? toNonEmptyString(entry.name);
    if (!text) {
      return [];
    }

    const durationMin = toFiniteNumber(entry.durationMin ?? entry.duration);
    const order = toFiniteNumber(entry.order ?? entry.index);

    return [
      {
        text,
        ...(durationMin !== undefined && durationMin >= 0 ? { durationMin: Math.round(durationMin) } : {}),
        order: order !== undefined && order >= 0 ? Math.round(order) : index,
      },
    ];
  });

  return normalized.length > 0 ? normalized : undefined;
};

const normalizedInstructionListSchema = z.preprocess(
  (value) => normalizeInstructionList(value),
  z.array(CanonicalInstructionSchema).optional(),
);

export const CanonicalNutritionSchema = z.object({
  calories: trimmedOptionalStringSchema,
  proteinContent: trimmedOptionalStringSchema,
  fatContent: trimmedOptionalStringSchema,
  carbohydrateContent: trimmedOptionalStringSchema,
  fiberContent: trimmedOptionalStringSchema,
  sodiumContent: trimmedOptionalStringSchema,
});

export type CanonicalNutrition = z.infer<typeof CanonicalNutritionSchema>;

const normalizeNutrition = (value: unknown): CanonicalNutrition | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const nutrition = {
    calories: toNonEmptyString(value.calories),
    proteinContent: toNonEmptyString(value.proteinContent),
    fatContent: toNonEmptyString(value.fatContent),
    carbohydrateContent: toNonEmptyString(value.carbohydrateContent),
    fiberContent: toNonEmptyString(value.fiberContent),
    sodiumContent: toNonEmptyString(value.sodiumContent),
  };

  return Object.values(nutrition).some((entry) => entry !== undefined) ? nutrition : undefined;
};

const normalizedNutritionSchema = z.preprocess(
  (value) => normalizeNutrition(value),
  CanonicalNutritionSchema.optional(),
);

export const CanonicalAuthorSchema = z.object({
  name: trimmedOptionalStringSchema,
  type: z.enum(["Person", "Organization"]).optional(),
});

export type CanonicalAuthor = z.infer<typeof CanonicalAuthorSchema>;

const normalizeAuthor = (value: unknown): CanonicalAuthor | undefined => {
  const authorName = toNonEmptyString(value);
  if (authorName) {
    return { name: authorName };
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const name = toNonEmptyString(value.name);
  const authorType =
    value.type === "Person" || value.type === "Organization"
      ? value.type
      : value["@type"] === "Person" || value["@type"] === "Organization"
        ? value["@type"]
        : undefined;

  if (!name && !authorType) {
    return undefined;
  }

  return {
    ...(name ? { name } : {}),
    ...(authorType ? { type: authorType } : {}),
  };
};

const normalizedAuthorSchema = z.preprocess((value) => normalizeAuthor(value), CanonicalAuthorSchema.optional());

const normalizedDifficultySchema = z.preprocess(
  (value) => normalizeEnumValue(value, DIFFICULTIES),
  z.enum(DIFFICULTIES).optional(),
);

const normalizedBudgetSchema = z.preprocess((value) => normalizeEnumValue(value, BUDGETS), z.enum(BUDGETS).optional());

const normalizedCategorySchema = z.preprocess(
  (value) => normalizeEnumValues(value, RECIPE_CATEGORIES),
  z.array(z.enum(RECIPE_CATEGORIES)).optional(),
);

const normalizedAttributeSchema = z.preprocess(
  (value) => normalizeEnumValues(value, RECIPE_ATTRIBUTES),
  z.array(z.enum(RECIPE_ATTRIBUTES)).optional(),
);

const normalizedStringListSchema = z.preprocess((value) => normalizeStringList(value), z.array(z.string()).optional());

const normalizedImageSchema = z.preprocess(
  (value) => normalizeImage(value),
  z.union([z.string(), z.array(z.string())]).optional(),
);

const canonicalRecipeInputSchema = z.object({
  name: trimmedOptionalStringSchema,
  description: trimmedOptionalStringSchema,
  servings: optionalPositiveIntegerSchema,
  yieldUnitLabel: trimmedOptionalStringSchema,
  prepTimeMin: optionalNonNegativeIntegerSchema,
  cookTimeMin: optionalNonNegativeIntegerSchema,
  totalTimeMin: optionalNonNegativeIntegerSchema,
  difficulty: normalizedDifficultySchema,
  budget: normalizedBudgetSchema,
  categories: normalizedCategorySchema,
  attributes: normalizedAttributeSchema,
  ingredients: normalizedIngredientListSchema,
  instructions: normalizedInstructionListSchema,
  image: normalizedImageSchema,
  author: normalizedAuthorSchema,
  nutrition: normalizedNutritionSchema,
  keywords: normalizedStringListSchema,
  cuisine: trimmedOptionalStringSchema,
});

export const CanonicalRecipeSchema = z.preprocess(
  (value) => (isRecord(value) ? value : {}),
  canonicalRecipeInputSchema.transform((value) => {
    const cookTimeMin = value.cookTimeMin ?? value.totalTimeMin;

    return {
      ...(value.name ? { name: value.name } : {}),
      ...(value.description ? { description: value.description } : {}),
      ...(value.servings !== undefined ? { servings: value.servings } : {}),
      ...(value.yieldUnitLabel ? { yieldUnitLabel: value.yieldUnitLabel } : {}),
      ...(value.prepTimeMin !== undefined ? { prepTimeMin: value.prepTimeMin } : {}),
      ...(cookTimeMin !== undefined ? { cookTimeMin } : {}),
      ...(value.difficulty ? { difficulty: value.difficulty } : {}),
      ...(value.budget ? { budget: value.budget } : {}),
      ...(value.categories ? { categories: value.categories } : {}),
      ...(value.attributes ? { attributes: value.attributes } : {}),
      ...(value.ingredients ? { ingredients: value.ingredients } : {}),
      ...(value.instructions ? { instructions: value.instructions } : {}),
      ...(value.image ? { image: value.image } : {}),
      ...(value.author ? { author: value.author } : {}),
      ...(value.nutrition ? { nutrition: value.nutrition } : {}),
      ...(value.keywords ? { keywords: value.keywords } : {}),
      ...(value.cuisine ? { cuisine: value.cuisine } : {}),
    };
  }),
);

export type CanonicalRecipe = z.output<typeof CanonicalRecipeSchema>;
export type CanonicalRecipeSchemaInput = z.input<typeof CanonicalRecipeSchema>;
export type CanonicalRecipeSchemaOutput = z.output<typeof CanonicalRecipeSchema>;

export const canonicalRecipeResponseSchema = {
  name: "CanonicalRecipe",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string" },
      description: { type: ["string", "null"] },
      servings: { type: ["number", "null"] },
      yieldUnitLabel: { type: ["string", "null"] },
      prepTimeMin: { type: ["number", "null"] },
      cookTimeMin: { type: ["number", "null"] },
      difficulty: { oneOf: [{ enum: [...DIFFICULTIES] }, { type: "null" }] },
      budget: { oneOf: [{ enum: [...BUDGETS] }, { type: "null" }] },
      categories: {
        oneOf: [{ type: "array", items: { enum: [...RECIPE_CATEGORIES] } }, { type: "null" }],
      },
      attributes: {
        oneOf: [{ type: "array", items: { enum: [...RECIPE_ATTRIBUTES] } }, { type: "null" }],
      },
      ingredients: {
        oneOf: [
          {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                quantity: { type: ["number", "null"] },
                unit: { type: ["string", "null"] },
                note: { type: ["string", "null"] },
                optional: { type: ["boolean", "null"] },
                order: { type: "number" },
                raw: { type: ["string", "null"] },
              },
              required: ["name", "order"],
            },
          },
          { type: "null" },
        ],
      },
      instructions: {
        oneOf: [
          {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                text: { type: "string" },
                order: { type: "number" },
                durationMin: { type: ["number", "null"] },
              },
              required: ["text", "order"],
            },
          },
          { type: "null" },
        ],
      },
      image: {
        oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }, { type: "null" }],
      },
      author: {
        oneOf: [
          {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: ["string", "null"] },
              type: { oneOf: [{ enum: ["Person", "Organization"] }, { type: "null" }] },
            },
          },
          { type: "null" },
        ],
      },
      nutrition: {
        oneOf: [
          {
            type: "object",
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
          { type: "null" },
        ],
      },
      keywords: {
        oneOf: [{ type: "array", items: { type: "string" } }, { type: "null" }],
      },
      cuisine: { type: ["string", "null"] },
    },
    required: ["name", "ingredients", "instructions"],
  },
} satisfies Record<string, unknown>;

export const normalizeCanonicalRecipe = (value: unknown): CanonicalRecipe => {
  const parsed = CanonicalRecipeSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
};
