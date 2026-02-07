import type { UserId } from "@recipe/domain";
import type { FastifyRequest, preHandlerHookHandler } from "fastify";
import type { AuthPort } from "../../application/ports.js";
import { ApiError } from "../errors/api.error.js";
import { ERROR_CODES } from "../errors/error-codes.js";

const toHeaderRecord = (headers: FastifyRequest["headers"]): Record<string, string> => {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") {
      normalized[key] = value;
      continue;
    }
    if (Array.isArray(value) && value.length > 0) {
      normalized[key] = value.join(",");
    }
  }
  return normalized;
};

export const createAuthPreHandler = (authPort: AuthPort): preHandlerHookHandler => {
  return async (request) => {
    try {
      const { userId } = await authPort.authenticate({
        headers: toHeaderRecord(request.headers),
      });
      request.userId = userId;
    } catch {
      throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, "Unauthorized");
    }
  };
};

export const requireUserId = (request: FastifyRequest): UserId => {
  const { userId } = request;
  if (!userId) {
    throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, "Missing authenticated user");
  }
  return userId;
};
