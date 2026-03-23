import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import type { EventBridgePort, LoggerPort, QueuePort } from "../application/ports.js";
import {
  CancelJobUseCase,
  CreateImportJobUseCase,
  GetJobResultUseCase,
  GetJobStatusUseCase,
} from "../application/use-cases.js";
import { PipelineRegistry } from "../core/registry/pipeline-registry.js";
import { createAuthPort } from "../infrastructure/auth.js";
import { BullMQQueue } from "../infrastructure/bullmq/queue.js";
import { QueueEventsBridge } from "../infrastructure/bullmq/queue-events-bridge.js";
import { consoleLogger } from "../infrastructure/logger.js";
import { tempInputStore } from "../infrastructure/temp-input-store.js";
import { ERROR_CODES } from "./errors/error-codes.js";
import { errorHandler } from "./errors/error-handler.js";
import { formatError } from "./helpers/response-format.js";
import { createAuthPreHandler } from "./plugins/authentication.js";
import { securityPlugin } from "./plugins/security.js";
import { healthRoutes } from "./routes/health/index.js";
import { importRoutes } from "./routes/import/index.js";
import { inputsRoutes } from "./routes/inputs/index.js";
import { jobsRoutes } from "./routes/jobs/index.js";
import { websocketRoutes } from "./setup-ws.js";

type ServerConfig = Readonly<{
  queuePort: QueuePort;
  eventBridge: EventBridgePort;
  logger?: LoggerPort;
}>;

const getRateLimitConfig = (): Readonly<{ max: number; timeWindow: number }> => {
  const max = Number.parseInt(process.env.API_RATE_LIMIT_MAX ?? "100", 10);
  const timeWindow = Number.parseInt(process.env.API_RATE_LIMIT_WINDOW_MS ?? "60000", 10);
  return { max, timeWindow };
};

const getBodyLimit = (): number => Number.parseInt(process.env.MAX_PAYLOAD_SIZE ?? "10485760", 10);

const keyGenerator = (request: FastifyRequest): string => {
  const headerValue = request.headers["x-user-id"];
  if (typeof headerValue === "string" && headerValue.trim().length > 0) {
    return headerValue;
  }
  if (Array.isArray(headerValue) && headerValue.length > 0) {
    return headerValue.join(",");
  }
  return request.ip;
};

export async function buildServer(config: ServerConfig): Promise<FastifyInstance> {
  const logger = config.logger ?? consoleLogger;

  const server = Fastify({
    logger: true,
    bodyLimit: getBodyLimit(),
  });

  server.setErrorHandler(errorHandler);
  server.setNotFoundHandler(async (_request, reply) => {
    return reply.status(404).send(formatError(ERROR_CODES.NOT_FOUND));
  });

  server.addContentTypeParser("application/octet-stream", { parseAs: "buffer" }, (_request, body, done) => {
    done(null, body);
  });

  await securityPlugin(server);

  const rateLimitConfig = getRateLimitConfig();
  await server.register(rateLimit, {
    max: rateLimitConfig.max,
    timeWindow: rateLimitConfig.timeWindow,
    keyGenerator,
    errorResponseBuilder: (_request, context) => {
      return formatError(ERROR_CODES.RATE_LIMIT_EXCEEDED, {
        details: { retryAfter: context.after },
      });
    },
    addHeadersOnExceeding: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
    },
  });

  const authPort = createAuthPort();
  const authenticate = createAuthPreHandler(authPort);
  const pipelineRegistry = new PipelineRegistry();

  const createImportJobUseCase = new CreateImportJobUseCase(config.queuePort, logger);
  const getJobStatusUseCase = new GetJobStatusUseCase(config.queuePort);
  const getJobResultUseCase = new GetJobResultUseCase(config.queuePort);
  const cancelJobUseCase = new CancelJobUseCase(config.queuePort, logger);

  await server.register(healthRoutes, {
    queuePort: config.queuePort,
  });

  await server.register(inputsRoutes, {
    preHandler: authenticate,
    tempInputStore,
  });

  await server.register(importRoutes, {
    preHandler: authenticate,
    createImportJobUseCase,
    pipelineRegistry,
  });

  await server.register(jobsRoutes, {
    preHandler: authenticate,
    getJobStatusUseCase,
    getJobResultUseCase,
    cancelJobUseCase,
  });

  await server.register(websocketRoutes, {
    authPort,
    eventBridge: config.eventBridge,
    getJobSnapshot: (jobId) => getJobStatusUseCase.execute(jobId),
  });

  return server;
}

export async function createServer(): Promise<FastifyInstance> {
  const queue = new BullMQQueue();
  await queue.waitUntilReady();

  const eventBridge = new QueueEventsBridge(queue.getQueueName(), queue.getConnectionOptions());
  const server = await buildServer({
    queuePort: queue,
    eventBridge,
  });

  // Register onClose hook before ready()
  server.addHook("onClose", async () => {
    await eventBridge.close();
    await queue.close();
  });

  await server.ready();
  return server;
}
