const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const asString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toStringArray = (value: unknown): string[] => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => asString(item) ?? (item != null ? String(item) : ""))
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
};

const flattenInstructions = (value: unknown, depth = 0): string[] => {
  if (depth > 4) {
    return [];
  }

  if (typeof value === "string") {
    return value.trim().length > 0 ? [value.trim()] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenInstructions(item, depth + 1));
  }

  if (isRecord(value)) {
    const text = asString(value.text ?? value.name);
    if (text) {
      return [text];
    }

    if ("itemListElement" in value) {
      return flattenInstructions(value.itemListElement, depth + 1);
    }
  }

  return [];
};

export const extractRecipeIngredients = (node: Record<string, unknown>): string[] => {
  const raw = node.recipeIngredient ?? node.ingredients;
  return toStringArray(raw);
};

export const extractRecipeInstructions = (node: Record<string, unknown>): string[] => {
  const raw = node.recipeInstructions ?? node.recipeInstruction;
  return flattenInstructions(raw);
};

export const scoreRecipeCandidate = (node: Record<string, unknown>): number => {
  const nameScore = asString(node.name) ? 1 : 0;
  const ingredientScore = extractRecipeIngredients(node).length > 0 ? 2 : 0;
  const instructionScore = extractRecipeInstructions(node).length > 0 ? 2 : 0;

  return nameScore + ingredientScore + instructionScore;
};
