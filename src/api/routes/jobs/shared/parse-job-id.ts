import { JobId } from "@recipe/domain";
import { ApiError } from "../../../errors/api.error.js";
import { ERROR_CODES } from "../../../errors/error-codes.js";
import { jobParamsSchema } from "./job-params-schema.js";

export const parseJobId = (params: unknown): JobId => {
  const parsedParams = jobParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    throw new ApiError(400, ERROR_CODES.INVALID_PATH_PARAMETER, "Invalid job id", {
      issues: parsedParams.error.issues,
    });
  }

  return new JobId(parsedParams.data.id);
};
