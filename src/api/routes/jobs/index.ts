import type { FastifyPluginAsync } from "fastify";
import { cancelJobRoute } from "./cancel-job/index.js";
import { getJobResultRoute } from "./get-job-result/index.js";
import { getJobStatusRoute } from "./get-job-status/index.js";
import type { JobsRoutesOptions } from "./types.js";

export type { JobsRoutesOptions } from "./types.js";

export const jobsRoutes: FastifyPluginAsync<JobsRoutesOptions> = async (server, options) => {
  await server.register(getJobStatusRoute, options);
  await server.register(getJobResultRoute, options);
  await server.register(cancelJobRoute, options);
};
