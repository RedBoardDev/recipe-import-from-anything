import type { FastifyRequest } from "fastify";
import { ApiError } from "../../../errors/api.error.js";
import { ERROR_CODES } from "../../../errors/error-codes.js";
import { formatSuccess } from "../../../helpers/response-format.js";
import { parseJobId } from "../shared/parse-job-id.js";
import type { JobsRoutesOptions } from "../types.js";
import type { GetJobStatusParams } from "./schema.js";

type GetJobStatusHandlerDependencies = Readonly<Pick<JobsRoutesOptions, "getJobStatusUseCase">>;

export const createGetJobStatusHandler = (dependencies: GetJobStatusHandlerDependencies) => {
  return async (request: FastifyRequest<{ Params: GetJobStatusParams }>) => {
    const jobId = parseJobId(request.params);
    const result = await dependencies.getJobStatusUseCase.execute(jobId);
    if (!result) {
      throw new ApiError(404, ERROR_CODES.JOB_NOT_FOUND, "Job not found");
    }

    return formatSuccess(result);
  };
};
