import type { FastifyPluginAsync } from "fastify";
import type { JobsRoutesOptions } from "../types.js";
import { createGetJobResultHandler } from "./handler.js";
import type { GetJobResultParams } from "./schema.js";

export const getJobResultRoute: FastifyPluginAsync<JobsRoutesOptions> = async (server, options) => {
  server.get<{ Params: GetJobResultParams }>(
    "/jobs/:id/result",
    {
      preHandler: options.preHandler,
    },
    createGetJobResultHandler({
      getJobResultUseCase: options.getJobResultUseCase,
    }),
  );
};
