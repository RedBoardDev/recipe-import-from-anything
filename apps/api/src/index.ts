import Fastify from "fastify";

export const buildServer = () => {
  const app = Fastify({
    logger: true
  });

  app.get("/health", async () => ({ status: "ok" }));

  return app;
};

if (process.env.NODE_ENV !== "test") {
  const app = buildServer();
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";

  app
    .listen({ port, host })
    .catch((error) => {
      app.log.error({ error }, "Failed to start server");
      process.exit(1);
    });
}
