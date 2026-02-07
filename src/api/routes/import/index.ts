import type { FastifyPluginAsync, preHandlerHookHandler } from "fastify";
import type { CreateImportJobUseCase } from "../../../application/use-cases.js";
import type { PipelineRegistry } from "../../../core/registry/pipeline-registry.js";
import { createImportHandler } from "./handler.js";
import type { ImportBody } from "./schema.js";

export type ImportRoutesOptions = Readonly<{
  preHandler: preHandlerHookHandler;
  createImportJobUseCase: CreateImportJobUseCase;
  pipelineRegistry: PipelineRegistry;
}>;

export const importRoutes: FastifyPluginAsync<ImportRoutesOptions> = async (server, options) => {
  server.post<{ Body: ImportBody }>(
    "/import",
    {
      preHandler: options.preHandler,
    },
    createImportHandler({
      createImportJobUseCase: options.createImportJobUseCase,
      pipelineRegistry: options.pipelineRegistry,
    }),
  );
};
