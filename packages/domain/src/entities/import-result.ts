import { Entity, UniqueEntityID } from "@recipe/domain-driven-design";
import { type CanonicalRecipe, normalizeCanonicalRecipe } from "../schemas/canonical-recipe.schema.js";
import type { EvidenceBundle } from "../types.js";
import type { Confidence } from "../value-objects/confidence.js";
import type { Warning } from "../value-objects/warning.js";

interface ImportResultProps {
  recipe: CanonicalRecipe;
  confidence: Confidence;
  evidence: EvidenceBundle;
  warnings: Warning[];
  meta: { sourceType: string; sourceValue: string; extractedAt: Date };
}

export const normalizeEvidence = (evidence?: Partial<EvidenceBundle>): EvidenceBundle => {
  if (!evidence) {
    return { artifactRefs: [] };
  }

  return {
    artifactRefs: Array.isArray(evidence.artifactRefs) ? [...evidence.artifactRefs] : [],
    ...(evidence.debug ? { debug: { ...evidence.debug } } : {}),
  };
};

export class ImportResult extends Entity<ImportResultProps> {
  constructor(
    recipe: unknown,
    confidence: Confidence,
    evidence?: Partial<EvidenceBundle>,
    warnings: readonly Warning[] = [],
    sourceType = "",
    sourceValue = "",
  ) {
    super(
      {
        recipe: normalizeCanonicalRecipe(recipe),
        confidence,
        evidence: normalizeEvidence(evidence),
        warnings: [...warnings],
        meta: { sourceType, sourceValue, extractedAt: new Date() },
      },
      new UniqueEntityID(),
    );
  }

  get recipe(): CanonicalRecipe {
    return this.props.recipe;
  }

  get confidence(): Confidence {
    return this.props.confidence;
  }

  get evidence(): EvidenceBundle {
    return this.props.evidence;
  }

  get warnings(): Warning[] {
    return [...this.props.warnings];
  }

  get meta(): { sourceType: string; sourceValue: string; extractedAt: Date } {
    return this.props.meta;
  }

  toJSON() {
    return {
      recipe: this.props.recipe,
      confidence: this.props.confidence.toJSON(),
      evidence: this.props.evidence,
      warnings: this.props.warnings,
      meta: {
        ...this.props.meta,
        extractedAt: this.props.meta.extractedAt.toISOString(),
      },
    };
  }
}
