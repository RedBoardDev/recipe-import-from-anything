import type { FastifyRequest } from "fastify";
import { ApiError } from "../../../errors/api.error.js";
import { ERROR_CODES } from "../../../errors/error-codes.js";
import { formatSuccess } from "../../../helpers/response-format.js";
import { parseJobId } from "../shared/parse-job-id.js";
import type { JobsRoutesOptions } from "../types.js";
import type { CancelJobParams } from "./schema.js";

type CancelJobHandlerDependencies = Readonly<Pick<JobsRoutesOptions, "cancelJobUseCase">>;

export const createCancelJobHandler = (dependencies: CancelJobHandlerDependencies) => {
  return async (request: FastifyRequest<{ Params: CancelJobParams }>) => {
    const jobId = parseJobId(request.params);
    const result = await dependencies.cancelJobUseCase.execute(jobId);
    if (result.notFound) {
      throw new ApiError(404, ERROR_CODES.JOB_NOT_FOUND, "Job not found");
    }

    if (!result.success) {
      throw new ApiError(409, ERROR_CODES.JOB_NOT_CANCELABLE, `Job cannot be canceled (status: ${result.status})`);
    }

    return formatSuccess({ jobId: result.jobId, status: result.status });
  };
};
