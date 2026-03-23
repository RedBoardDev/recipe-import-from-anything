export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;

  readonly args?: Record<string, string | number | boolean>;
  readonly details?: unknown;

  constructor(message: string, options?: { args?: Record<string, string | number | boolean>; details?: unknown }) {
    super(message);
    this.name = this.constructor.name;
    this.args = options?.args;
    this.details = options?.details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
