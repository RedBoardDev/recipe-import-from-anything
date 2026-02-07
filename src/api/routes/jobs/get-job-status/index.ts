import type { FastifyPluginAsync } from "fastify";
import type { JobsRoutesOptions } from "../types.js";
import { createGetJobStatusHandler } from "./handler.js";
import type { GetJobStatusParams } from "./schema.js";

export const getJobStatusRoute: FastifyPluginAsync<JobsRoutesOptions> = async (server, options) => {
  server.get<{ Params: GetJobStatusParams }>(
    "/jobs/:id",
    {
      preHandler: options.preHandler,
    },
    createGetJobStatusHandler({
      getJobStatusUseCase: options.getJobStatusUseCase,
    }),
  );
};
