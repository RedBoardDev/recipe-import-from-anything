import type { FastifyRequest } from "fastify";
import { ApiError } from "../../../errors/api.error.js";
import { ERROR_CODES } from "../../../errors/error-codes.js";
import { formatSuccess } from "../../../helpers/response-format.js";
import { parseJobId } from "../shared/parse-job-id.js";
import type { JobsRoutesOptions } from "../types.js";
import type { GetJobResultParams } from "./schema.js";

type GetJobResultHandlerDependencies = Readonly<Pick<JobsRoutesOptions, "getJobResultUseCase">>;

export const createGetJobResultHandler = (dependencies: GetJobResultHandlerDependencies) => {
  return async (request: FastifyRequest<{ Params: GetJobResultParams }>) => {
    const jobId = parseJobId(request.params);
    const result = await dependencies.getJobResultUseCase.execute(jobId);
    if (!result) {
      throw new ApiError(404, ERROR_CODES.JOB_NOT_FOUND, "Job not found");
    }

    if (result.status !== "completed") {
      throw new ApiError(409, ERROR_CODES.JOB_NOT_SUCCEEDED, `Job has status: ${result.status}`);
    }

    return formatSuccess(result);
  };
};
