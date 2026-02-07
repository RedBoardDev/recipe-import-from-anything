import type { preHandlerHookHandler } from "fastify";
import type { CancelJobUseCase, GetJobResultUseCase, GetJobStatusUseCase } from "../../../application/use-cases.js";

export type JobsRoutesOptions = Readonly<{
  preHandler: preHandlerHookHandler;
  getJobStatusUseCase: GetJobStatusUseCase;
  getJobResultUseCase: GetJobResultUseCase;
  cancelJobUseCase: CancelJobUseCase;
}>;
