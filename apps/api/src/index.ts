import Fastify from "fastify";
import { ZodError } from "zod";
import "./types";
import { buildApiRuntime } from "./dependencies";
import { registerRoutes } from "./routes";

export const buildServer = async () => {
  const app = Fastify({
    logger: true
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      reply.status(400).send({
        error: "invalid_payload",
        issues: error.issues
      });
      return;
    }

    throw error;
  });

  const runtime = buildApiRuntime();
  await registerRoutes(app, runtime);

  app.addHook("onClose", async () => {
    await runtime.shutdown();
  });

  return app;
};

if (process.env.NODE_ENV !== "test") {
  const start = async () => {
    const app = await buildServer();
    const port = Number(process.env.PORT ?? 3000);
    const host = process.env.HOST ?? "0.0.0.0";

    await app.listen({ port, host });
  };

  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
