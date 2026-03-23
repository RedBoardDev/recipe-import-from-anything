import { ValueObject } from "@recipe/domain-driven-design";

export class IdempotencyKey extends ValueObject<{ value: string }> {
  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("IdempotencyKey cannot be empty");
    }
    super({ value });
  }

  get value(): string {
    return this.props.value;
  }

  toString(): string {
    return this.props.value;
  }
}
