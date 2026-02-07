import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { formatError } from "../helpers/response-format.js";
import { ApiError } from "./api.error.js";
import { ERROR_CODES } from "./error-codes.js";

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  request.log.error(error);

  if (error instanceof ApiError) {
    return reply.status(error.httpStatus).send(formatError(error.code, { details: error.details, args: error.args }));
  }

  if (error.validation) {
    return reply.status(400).send(formatError(ERROR_CODES.VALIDATION_ERROR, { details: error.validation }));
  }

  if (error.statusCode === 404) {
    return reply.status(404).send(formatError(ERROR_CODES.NOT_FOUND));
  }

  if (error.statusCode === 429) {
    return reply.status(429).send(formatError(ERROR_CODES.RATE_LIMIT_EXCEEDED));
  }

  return reply.status(500).send(formatError(ERROR_CODES.INTERNAL_ERROR));
}
