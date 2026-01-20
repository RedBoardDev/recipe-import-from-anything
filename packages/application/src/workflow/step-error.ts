export class StepExecutionError extends Error {
  constructor(
    public readonly stepId: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "StepExecutionError";
  }
}
