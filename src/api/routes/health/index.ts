import type { FastifyPluginAsync } from "fastify";
import type { QueuePort } from "../../../application/ports.js";
import { createHealthHandler } from "./handler.js";

export type HealthRoutesOptions = Readonly<{
  queuePort: QueuePort;
}>;

export const healthRoutes: FastifyPluginAsync<HealthRoutesOptions> = async (server, options) => {
  server.get("/health", createHealthHandler({ queuePort: options.queuePort }));
};
