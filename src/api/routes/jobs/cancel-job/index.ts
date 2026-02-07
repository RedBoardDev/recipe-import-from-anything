import type { FastifyPluginAsync } from "fastify";
import type { JobsRoutesOptions } from "../types.js";
import { createCancelJobHandler } from "./handler.js";
import type { CancelJobParams } from "./schema.js";

export const cancelJobRoute: FastifyPluginAsync<JobsRoutesOptions> = async (server, options) => {
  server.post<{ Params: CancelJobParams }>(
    "/jobs/:id/cancel",
    {
      preHandler: options.preHandler,
    },
    createCancelJobHandler({
      cancelJobUseCase: options.cancelJobUseCase,
    }),
  );
};
