import { JobId } from "@recipe/domain";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { QueuePort } from "../../../application/ports.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { formatError, formatSuccess } from "../../helpers/response-format.js";
import type { HealthCheck } from "./schema.js";

type HealthHandlerDependencies = Readonly<{
  queuePort: QueuePort;
}>;

export const createHealthHandler = (dependencies: HealthHandlerDependencies) => {
  return async (_request: FastifyRequest, reply: FastifyReply) => {
    const redis = await dependencies.queuePort
      .ping()
      .then(() => "ok" as const)
      .catch(() => "error" as const);

    const queue = await dependencies.queuePort
      .getJobState(new JobId("health-check"))
      .then(() => "ok" as const)
      .catch(() => "error" as const);

    const checks: HealthCheck = {
      api: "ok",
      redis,
      queue,
      timestamp: new Date().toISOString(),
    };

    if (redis === "error" || queue === "error") {
      return reply.status(503).send(formatError(ERROR_CODES.EXTERNAL_SERVICE_ERROR, { details: checks }));
    }

    return formatSuccess(checks);
  };
};
