import { assertEnvironment } from "../infrastructure/config-validator.js";
import { createServer } from "./server.js";

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

async function main() {
  console.log("Starting API server...");

  assertEnvironment();

  const server = await createServer();
  await server.listen({ port: PORT, host: HOST });
  console.log(`API server listening on http://${HOST}:${PORT}`);
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
