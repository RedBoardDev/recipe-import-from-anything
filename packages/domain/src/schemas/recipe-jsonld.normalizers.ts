export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const toNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const FRACTION_PATTERN = /^(\d+)\/(\d+)$/;
const MIXED_FRACTION_PATTERN = /^(\d+)\s+(\d+)\/(\d+)$/;
const ISO_DURATION_PATTERN = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i;
const HOUR_DURATION_PATTERN = /^(?:(\d+(?:[.,]\d+)?)\s*h(?:[a-z]*)?)\s*(?:(\d+(?:[.,]\d+)?)\s*m(?:[a-z]*)?)?$/i;
const MINUTE_DURATION_PATTERN = /^(\d+(?:[.,]\d+)?)\s*m(?:[a-z]*)?$/i;

const parseStringNumber = (value: string): number | undefined => {
  const normalized = value.trim().replace(",", ".");
  if (normalized.length === 0) {
    return undefined;
  }

  const mixedFractionMatch = normalized.match(MIXED_FRACTION_PATTERN);
  if (mixedFractionMatch) {
    const whole = Number(mixedFractionMatch[1]);
    const numerator = Number(mixedFractionMatch[2]);
    const denominator = Number(mixedFractionMatch[3]);

    if (Number.isFinite(whole) && Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return whole + numerator / denominator;
    }
  }

  const fractionMatch = normalized.match(FRACTION_PATTERN);
  if (fractionMatch) {
    const numerator = Number(fractionMatch[1]);
    const denominator = Number(fractionMatch[2]);

    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return numerator / denominator;
    }
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  return parseStringNumber(value);
};

const toNonNegativeInteger = (value: unknown): number | undefined => {
  const parsed = toFiniteNumber(value);
  if (parsed === undefined || parsed < 0) {
    return undefined;
  }

  return Math.round(parsed);
};

export const normalizeMinutes = (value: unknown): number | undefined => {
  const directValue = toNonNegativeInteger(value);
  if (directValue !== undefined) {
    return directValue;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return undefined;
  }

  const isoMatch = normalized.match(ISO_DURATION_PATTERN);
  if (isoMatch) {
    const days = Number(isoMatch[1] ?? "0");
    const hours = Number(isoMatch[2] ?? "0");
    const minutes = Number(isoMatch[3] ?? "0");
    return days * 24 * 60 + hours * 60 + minutes;
  }

  const hourMatch = normalized.match(HOUR_DURATION_PATTERN);
  if (hourMatch) {
    const hours = parseStringNumber(hourMatch[1] ?? "0") ?? 0;
    const minutes = parseStringNumber(hourMatch[2] ?? "0") ?? 0;
    return Math.round(hours * 60 + minutes);
  }

  const minuteMatch = normalized.match(MINUTE_DURATION_PATTERN);
  if (minuteMatch) {
    const minutes = parseStringNumber(minuteMatch[1]);
    return minutes === undefined ? undefined : Math.round(minutes);
  }

  return undefined;
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

export type NormalizedRecipeIngredient = Readonly<{
  name: string;
  quantity?: number;
  unit?: string;
  note?: string;
  optional?: boolean;
  order: number;
  raw?: string;
}>;

const NORMALIZED_INGREDIENT_UNITS: Record<string, string> = {
  g: "g",
  gram: "g",
  grams: "g",
  gr: "g",
  kg: "kg",
  ml: "ml",
  cl: "cl",
  dl: "dl",
  l: "l",
  cup: "cup",
  cups: "cup",
  tbsp: "tbsp",
  tsp: "tsp",
  oz: "oz",
  lb: "lb",
  pinch: "pinch",
  pinches: "pinch",
  slice: "slice",
  slices: "slice",
  can: "can",
  cans: "can",
};

const normalizeUnitToken = (value: string): string | undefined => {
  const normalizedKey = value
    .trim()
    .toLowerCase()
    .replace(/[()[\].]/g, "")
    .replace(/,+$/, "");

  return NORMALIZED_INGREDIENT_UNITS[normalizedKey];
};

const parseLeadingQuantity = (tokens: readonly string[]): Readonly<{ quantity?: number; consumed: number }> => {
  if (tokens.length === 0) {
    return { consumed: 0 };
  }

  if (tokens.length >= 2) {
    const mixedFractionValue = parseStringNumber(`${tokens[0]} ${tokens[1]}`);
    if (mixedFractionValue !== undefined) {
      return { quantity: mixedFractionValue, consumed: 2 };
    }
  }

  const directValue = parseStringNumber(tokens[0]);
  if (directValue !== undefined) {
    return { quantity: directValue, consumed: 1 };
  }

  return { consumed: 0 };
};

const parseIngredientLine = (value: string, index: number): NormalizedRecipeIngredient | undefined => {
  const raw = toNonEmptyString(value);
  if (!raw) {
    return undefined;
  }

  const tokens = raw.split(/\s+/);
  const quantityInfo = parseLeadingQuantity(tokens);
  let currentIndex = quantityInfo.consumed;
  let unit: string | undefined;

  if (quantityInfo.quantity !== undefined && currentIndex < tokens.length) {
    unit = normalizeUnitToken(tokens[currentIndex]);
    if (unit) {
      currentIndex += 1;
    }
  }

  const name = tokens.slice(currentIndex).join(" ").trim() || raw;

  return {
    name,
    ...(quantityInfo.quantity !== undefined ? { quantity: quantityInfo.quantity } : {}),
    ...(unit ? { unit } : {}),
    order: index,
    raw,
  };
};

export const normalizeIngredientList = (value: unknown): NormalizedRecipeIngredient[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value.flatMap((entry, index): NormalizedRecipeIngredient[] => {
    if (typeof entry === "string") {
      const parsedEntry = parseIngredientLine(entry, index);
      return parsedEntry ? [parsedEntry] : [];
    }

    if (!isRecord(entry)) {
      return [];
    }

    const raw =
      toNonEmptyString(entry.raw) ??
      toNonEmptyString(entry.line) ??
      (typeof entry.text === "string" ? toNonEmptyString(entry.text) : undefined);
    const name =
      toNonEmptyString(entry.name) ??
      toNonEmptyString(entry.ingredient) ??
      toNonEmptyString(entry.line) ??
      toNonEmptyString(entry.text);

    if (!name) {
      return [];
    }

    const quantity = toFiniteNumber(entry.quantity ?? entry.amount);
    const order = toNonNegativeInteger(entry.order ?? entry.index) ?? index;
    const note = toNonEmptyString(entry.note);
    const unit = toNonEmptyString(entry.unit);

    return [
      {
        name,
        ...(quantity !== undefined ? { quantity } : {}),
        ...(unit ? { unit } : {}),
        ...(note ? { note } : {}),
        ...(typeof entry.optional === "boolean" ? { optional: entry.optional } : {}),
        order,
        ...(raw ? { raw } : {}),
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

export const normalizeStringList = (value: unknown): string[] | undefined => {
  const singleValue = toNonEmptyString(value);
  if (singleValue) {
    const normalized = singleValue
      .split(/[,;]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    return normalized.length > 0 ? [...new Set(normalized)] : undefined;
  }

  return normalizeStringArray(value);
};

const normalizeEnumKey = (value: string): string =>
  value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

export const normalizeEnumValue = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined => {
  const normalizedValue = toNonEmptyString(value);
  if (!normalizedValue) {
    return undefined;
  }

  const candidate = normalizeEnumKey(normalizedValue);
  return allowed.find((entry) => entry === candidate);
};

export const normalizeEnumValues = <T extends string>(value: unknown, allowed: readonly T[]): T[] | undefined => {
  const normalizedEntries = normalizeStringList(value);
  if (!normalizedEntries) {
    return undefined;
  }

  const mappedEntries = normalizedEntries.flatMap((entry) => {
    const normalizedEntry = normalizeEnumValue(entry, allowed);
    return normalizedEntry ? [normalizedEntry] : [];
  });

  return mappedEntries.length > 0 ? [...new Set(mappedEntries)] : undefined;
};

export const normalizeImage = (value: unknown): string | string[] | undefined => {
  const single = toNonEmptyString(value);
  if (single) {
    return single;
  }

  return normalizeStringArray(value);
};
