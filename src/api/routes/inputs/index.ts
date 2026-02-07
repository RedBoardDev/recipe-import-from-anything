import type { TempInputStore } from "@recipe/pipeline-contracts";
import type { FastifyPluginAsync, preHandlerHookHandler } from "fastify";
import { createInputsHandler } from "./handler.js";
import type { InputBody } from "./schema.js";

export type InputsRoutesOptions = Readonly<{
  preHandler: preHandlerHookHandler;
  tempInputStore: TempInputStore;
}>;

export const inputsRoutes: FastifyPluginAsync<InputsRoutesOptions> = async (server, options) => {
  server.post<{ Body: InputBody }>(
    "/inputs",
    {
      preHandler: options.preHandler,
    },
    createInputsHandler({ tempInputStore: options.tempInputStore }),
  );
};
