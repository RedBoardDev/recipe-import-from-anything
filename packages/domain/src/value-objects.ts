import { v4 as uuidv4 } from "uuid";
import type { ConfidenceLevel } from "./types.js";

export class JobId {
  private readonly _value: string;

  constructor(value?: string) {
    this._value = value ?? uuidv4();
  }

  get value(): string {
    return this._value;
  }

  equals(other: JobId): boolean {
    return this._value === other.value;
  }

  toString(): string {
    return this._value;
  }
}

export class UserId {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("UserId cannot be empty");
    }
    this._value = value;
  }

  get value(): string {
    return this._value;
  }

  equals(other: UserId): boolean {
    return this._value === other.value;
  }

  toString(): string {
    return this._value;
  }
}

export class IdempotencyKey {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("IdempotencyKey cannot be empty");
    }
    this._value = value;
  }

  get value(): string {
    return this._value;
  }

  equals(other: IdempotencyKey): boolean {
    return this._value === other.value;
  }

  toString(): string {
    return this._value;
  }
}

export class Confidence {
  private readonly _value: number;
  private readonly _level: ConfidenceLevel;

  constructor(value: number) {
    if (value < 0 || value > 1) {
      throw new Error("Confidence must be between 0 and 1");
    }
    this._value = value;

    if (value >= 0.8) {
      this._level = "high";
    } else if (value >= 0.5) {
      this._level = "medium";
    } else {
      this._level = "low";
    }
  }

  get value(): number {
    return this._value;
  }

  get level(): ConfidenceLevel {
    return this._level;
  }

  toJSON(): { value: number; level: ConfidenceLevel } {
    return { value: this._value, level: this._level };
  }

  equals(other: Confidence): boolean {
    return this._value === other.value;
  }
}
