export interface ParsedTextRecipe {
  title?: string;
  ingredients: string[];
  instructions: string[];
}

const INGREDIENT_HEADER = /^(ingredients?|ingr?edients?)\b/i;
const INSTRUCTION_HEADER = /^(instructions?|directions?|steps?|method|preparation)\b/i;

const normalizeLine = (line: string): string => line.trim();

const stripBullet = (line: string): string => {
  const bulletMatch = line.match(/^(?:\d+[\).]|[-*])\s+(.*)$/);
  return bulletMatch ? bulletMatch[1].trim() : line.trim();
};

const detectHeading = (line: string): "ingredients" | "instructions" | null => {
  const normalized = line.replace(/:$/, "").trim();
  if (INGREDIENT_HEADER.test(normalized)) {
    return "ingredients";
  }
  if (INSTRUCTION_HEADER.test(normalized)) {
    return "instructions";
  }
  return null;
};

const looksLikeInstruction = (line: string): boolean => {
  if (/^\d+[\).]/.test(line)) {
    return true;
  }

  return /^(step\s*\d+|mix|cook|bake|heat|stir|serve|combine|whisk|add)\b/i.test(line);
};

const splitFallback = (lines: string[]): { ingredients: string[]; instructions: string[] } => {
  const ingredients: string[] = [];
  const instructions: string[] = [];

  for (const line of lines) {
    if (looksLikeInstruction(line)) {
      instructions.push(stripBullet(line));
    } else {
      ingredients.push(stripBullet(line));
    }
  }

  if (instructions.length === 0 && ingredients.length > 1) {
    const pivot = Math.ceil(ingredients.length / 2);
    instructions.push(...ingredients.splice(pivot));
  }

  return { ingredients, instructions };
};

export const parseTextRecipe = (text: string): ParsedTextRecipe => {
  const lines = text.split(/\r?\n/).map(normalizeLine);
  const ingredients: string[] = [];
  const instructions: string[] = [];
  const fallbackLines: string[] = [];

  let title: string | undefined;
  let currentSection: "ingredients" | "instructions" | null = null;
  let sawHeading = false;

  for (const line of lines) {
    if (!line) {
      continue;
    }

    const heading = detectHeading(line);
    if (heading) {
      currentSection = heading;
      sawHeading = true;
      continue;
    }

    if (!title && !sawHeading) {
      title = line;
      continue;
    }

    const normalized = stripBullet(line);
    if (!normalized) {
      continue;
    }

    if (currentSection === "ingredients") {
      ingredients.push(normalized);
    } else if (currentSection === "instructions") {
      instructions.push(normalized);
    } else {
      fallbackLines.push(line);
    }
  }

  if (!sawHeading && fallbackLines.length > 0) {
    const fallback = splitFallback(fallbackLines);
    ingredients.push(...fallback.ingredients);
    instructions.push(...fallback.instructions);
  }

  return {
    title,
    ingredients,
    instructions
  };
};
