import type { Warning } from "./events.js";
import type { Confidence } from "./value-objects.js";

export interface RecipeJsonLd {
  "@context": string;
  "@type": "Recipe";
  name: string;
  description?: string;
  author?: {
    "@type": "Person" | "Organization";
    name: string;
  };
  datePublished?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeYield?: string | number;
  recipeIngredient?: string[];
  instructions?: Array<{
    "@type": "HowToStep" | "HowToSection";
    text: string;
    name?: string;
    url?: string;
  }>;
  nutrition?: {
    calories?: string;
    proteinContent?: string;
    fatContent?: string;
    carbohydrateContent?: string;
    fiberContent?: string;
    sodiumContent?: string;
  };
  image?: string | string[];
  keywords?: string;
  cuisine?: string;
  aggregateRating?: {
    ratingValue: number;
    reviewCount: number;
  };
}

export interface EvidenceBundle {
  htmlTitle?: string;
  ogTitle?: string;
  ogDescription?: string;
  canonicalUrl?: string;
  artifactRefs?: string[];
  debug?: {
    rawHtmlRef?: string;
    extractedTextRef?: string;
    jsonLdRef?: string;
  };
}

export class ImportResult {
  private readonly _recipe: RecipeJsonLd;
  private readonly _confidence: Confidence;
  private readonly _evidence: EvidenceBundle;
  private readonly _warnings: Warning[];
  private readonly _meta: {
    sourceType: string;
    sourceValue: string;
    extractedAt: Date;
  };

  constructor(
    recipe: RecipeJsonLd,
    confidence: Confidence,
    evidence: EvidenceBundle,
    warnings: Warning[],
    sourceType: string,
    sourceValue: string,
  ) {
    this._recipe = recipe;
    this._confidence = confidence;
    this._evidence = evidence;
    this._warnings = warnings;
    this._meta = {
      sourceType,
      sourceValue,
      extractedAt: new Date(),
    };
  }

  get recipe(): RecipeJsonLd {
    return this._recipe;
  }
  get confidence(): Confidence {
    return this._confidence;
  }
  get evidence(): EvidenceBundle {
    return this._evidence;
  }
  get warnings(): Warning[] {
    return this._warnings;
  }
  get meta(): { sourceType: string; sourceValue: string; extractedAt: Date } {
    return this._meta;
  }

  toJSON(): Record<string, unknown> {
    return {
      recipe: this._recipe,
      confidence: this._confidence,
      evidence: this._evidence,
      warnings: this._warnings,
      meta: this._meta,
    };
  }

  isPartial(): boolean {
    return this._warnings.length > 0 || this._confidence.level !== "high";
  }
}
