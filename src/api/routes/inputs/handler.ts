import type { TempInputStore } from "@recipe/pipeline-contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ApiError } from "../../errors/api.error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { formatSuccess } from "../../helpers/response-format.js";
import { type InputBody, inputBodySchema } from "./schema.js";

type InputsHandlerDependencies = Readonly<{
  tempInputStore: TempInputStore;
}>;

export const createInputsHandler = (dependencies: InputsHandlerDependencies) => {
  return async (request: FastifyRequest<{ Body: InputBody }>, reply: FastifyReply) => {
    const parsedBody = inputBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw new ApiError(400, ERROR_CODES.INVALID_INPUT, "Missing binary payload", {
        issues: parsedBody.error.issues,
      });
    }

    const inputRef = await dependencies.tempInputStore.save(parsedBody.data);
    return reply.status(201).send(formatSuccess({ inputRef }));
  };
};
