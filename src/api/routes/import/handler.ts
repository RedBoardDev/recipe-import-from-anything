import type { FastifyReply, FastifyRequest } from "fastify";
import type { CreateImportJobUseCase } from "../../../application/use-cases.js";
import type { PipelineRegistry } from "../../../core/registry/pipeline-registry.js";
import { ApiError } from "../../errors/api.error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { formatSuccess } from "../../helpers/response-format.js";
import { requireUserId } from "../../plugins/authentication.js";
import { type ImportBody, importBodySchema } from "./schema.js";

type ImportHandlerDependencies = Readonly<{
  createImportJobUseCase: CreateImportJobUseCase;
  pipelineRegistry: PipelineRegistry;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const mergeInputRef = (payload: unknown, inputRef?: string): unknown => {
  if (inputRef === undefined) {
    return payload;
  }

  if (payload === undefined) {
    return { inputRef };
  }

  if (!isRecord(payload)) {
    throw new ApiError(400, ERROR_CODES.INVALID_INPUT, "Payload must be an object when 'inputRef' is provided");
  }

  return { ...payload, inputRef };
};

const resolveIdempotencyKey = (request: FastifyRequest): string | undefined => {
  const idempotencyKeyHeader = request.headers["idempotency-key"];
  if (typeof idempotencyKeyHeader === "string") {
    return idempotencyKeyHeader;
  }

  if (Array.isArray(idempotencyKeyHeader)) {
    return idempotencyKeyHeader[0];
  }

  return undefined;
};

export const createImportHandler = (dependencies: ImportHandlerDependencies) => {
  return async (request: FastifyRequest<{ Body: ImportBody }>, reply: FastifyReply) => {
    const parsedBody = importBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw new ApiError(400, ERROR_CODES.INVALID_INPUT, "Missing or invalid request body", {
        issues: parsedBody.error.issues,
      });
    }

    const { pipelineId, payload, inputRef } = parsedBody.data;

    const config = dependencies.pipelineRegistry.getConfig(pipelineId);
    if (!config) {
      throw new ApiError(404, ERROR_CODES.INVALID_INPUT, `Unknown pipeline: ${pipelineId}`);
    }

    const mergedPayload = mergeInputRef(payload, inputRef);
    const meta = await dependencies.pipelineRegistry.getMeta(pipelineId);
    const validatedPayload = meta.inputSchema.safeParse(mergedPayload);
    if (!validatedPayload.success) {
      throw new ApiError(400, ERROR_CODES.INVALID_INPUT, "Payload validation failed", {
        issues: validatedPayload.error.issues,
      });
    }

    const userId = requireUserId(request);
    const result = await dependencies.createImportJobUseCase.execute(userId, {
      pipelineId,
      payload: validatedPayload.data,
      idempotencyKey: resolveIdempotencyKey(request),
      inputRef,
    });

    return reply.status(202).send(
      formatSuccess({
        jobId: result.jobId.toString(),
        isDuplicate: result.isDuplicate,
      }),
    );
  };
};
