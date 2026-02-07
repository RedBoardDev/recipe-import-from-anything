import type { ApiErrorArgs } from "../helpers/response-format.js";
import { ERROR_CODES, type ErrorCode } from "./error-codes.js";

export class ApiError extends Error {
  readonly type = "ApiError";

  constructor(
    public readonly httpStatus: number,
    public readonly code: ErrorCode,
    message?: string,
    public readonly details?: unknown,
    public readonly args?: ApiErrorArgs,
  ) {
    super(message ?? code);
    this.name = "ApiError";
  }

  static badRequest(message = "Bad request", details?: unknown) {
    return new ApiError(400, ERROR_CODES.BAD_REQUEST, message, details);
  }

  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, ERROR_CODES.UNAUTHORIZED, message);
  }

  static forbidden(message = "Forbidden") {
    return new ApiError(403, ERROR_CODES.FORBIDDEN, message);
  }

  static notFound(message = "Not found") {
    return new ApiError(404, ERROR_CODES.NOT_FOUND, message);
  }

  static conflict(message = "Conflict") {
    return new ApiError(409, ERROR_CODES.CONFLICT, message);
  }

  static validation(message = "Validation failed", details?: unknown) {
    return new ApiError(400, ERROR_CODES.VALIDATION_ERROR, message, details);
  }

  static internal(message = "Internal server error", details?: unknown) {
    return new ApiError(500, ERROR_CODES.INTERNAL_ERROR, message, details);
  }

  static rateLimitExceeded(message = "Too many requests") {
    return new ApiError(429, ERROR_CODES.RATE_LIMIT_EXCEEDED, message);
  }
}
