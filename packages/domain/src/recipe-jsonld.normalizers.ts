export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const toNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

export const normalizeInstructions = (
  value: unknown,
):
  | Array<{
      "@type": "HowToStep" | "HowToSection";
      text?: string;
      name?: string;
      url?: string;
    }>
  | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value.flatMap((entry) => {
    if (typeof entry === "string") {
      const text = toNonEmptyString(entry);
      return text ? [{ "@type": "HowToStep" as const, text }] : [];
    }

    if (!isRecord(entry)) {
      return [];
    }

    const text = toNonEmptyString(entry.text);
    const name = toNonEmptyString(entry.name);
    const url = toNonEmptyString(entry.url);

    if (!text && !name) {
      return [];
    }

    return [
      {
        "@type": entry["@type"] === "HowToSection" ? ("HowToSection" as const) : ("HowToStep" as const),
        ...(text ? { text } : {}),
        ...(name ? { name } : {}),
        ...(url ? { url } : {}),
      },
    ];
  });

  return normalized.length > 0 ? normalized : undefined;
};

export const normalizeNutrition = (
  value: unknown,
):
  | {
      calories?: string;
      proteinContent?: string;
      fatContent?: string;
      carbohydrateContent?: string;
      fiberContent?: string;
      sodiumContent?: string;
    }
  | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const normalized = {
    calories: toNonEmptyString(value.calories),
    proteinContent: toNonEmptyString(value.proteinContent),
    fatContent: toNonEmptyString(value.fatContent),
    carbohydrateContent: toNonEmptyString(value.carbohydrateContent),
    fiberContent: toNonEmptyString(value.fiberContent),
    sodiumContent: toNonEmptyString(value.sodiumContent),
  };

  return Object.values(normalized).some((entry) => entry !== undefined) ? normalized : undefined;
};

export const normalizeAuthor = (
  value: unknown,
):
  | {
      "@type"?: "Person" | "Organization";
      name?: string;
    }
  | undefined => {
  const authorName = toNonEmptyString(value);
  if (authorName) {
    return { name: authorName };
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const name = toNonEmptyString(value.name);
  const authorType = value["@type"] === "Person" || value["@type"] === "Organization" ? value["@type"] : undefined;

  if (!name && !authorType) {
    return undefined;
  }

  return {
    ...(authorType ? { "@type": authorType } : {}),
    ...(name ? { name } : {}),
  };
};

export const normalizeAggregateRating = (
  value: unknown,
):
  | {
      ratingValue?: number;
      reviewCount?: number;
    }
  | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const ratingValue =
    typeof value.ratingValue === "number" && Number.isFinite(value.ratingValue) ? value.ratingValue : undefined;
  const reviewCount =
    typeof value.reviewCount === "number" && Number.isFinite(value.reviewCount) ? value.reviewCount : undefined;

  if (ratingValue === undefined && reviewCount === undefined) {
    return undefined;
  }

  return {
    ...(ratingValue !== undefined ? { ratingValue } : {}),
    ...(reviewCount !== undefined ? { reviewCount } : {}),
  };
};

export const normalizeRecipeType = (value: unknown): "Recipe" | undefined => {
  if (value === "Recipe") {
    return "Recipe";
  }

  if (Array.isArray(value) && value.some((entry) => entry === "Recipe")) {
    return "Recipe";
  }

  return undefined;
};

export const normalizeRecipeYield = (value: unknown): string | number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return toNonEmptyString(value);
};

export const normalizeStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((entry) => toNonEmptyString(entry))
    .filter((entry): entry is string => entry !== undefined);

  if (normalized.length === 0) {
    return undefined;
  }

  return [...new Set(normalized)];
};

export const normalizeImage = (value: unknown): string | string[] | undefined => {
  const single = toNonEmptyString(value);
  if (single) {
    return single;
  }

  return normalizeStringArray(value);
};
