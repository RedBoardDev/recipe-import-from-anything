import { ValueObject } from "@recipe/domain-driven-design";

export type ConfidenceLevel = "high" | "medium" | "low";

export class Confidence extends ValueObject<{ value: number; level: ConfidenceLevel }> {
  constructor(value: number) {
    if (value < 0 || value > 1) {
      throw new Error("Confidence must be between 0 and 1");
    }
    const level: ConfidenceLevel = value >= 0.8 ? "high" : value >= 0.5 ? "medium" : "low";
    super({ value, level });
  }

  get value(): number {
    return this.props.value;
  }

  get level(): ConfidenceLevel {
    return this.props.level;
  }

  toJSON(): { value: number; level: ConfidenceLevel } {
    return { value: this.props.value, level: this.props.level };
  }
}
