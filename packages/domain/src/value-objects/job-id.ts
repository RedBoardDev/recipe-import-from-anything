import { ValueObject } from "@recipe/domain-driven-design";
import { v4 as uuidv4 } from "uuid";

export class JobId extends ValueObject<{ value: string }> {
  constructor(value?: string) {
    super({ value: value ?? uuidv4() });
  }

  get value(): string {
    return this.props.value;
  }

  toString(): string {
    return this.props.value;
  }
}
