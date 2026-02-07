import { RecipeProcessor } from "./processor.js";

const MAX_CONCURRENT_JOBS = Number.parseInt(process.env.MAX_CONCURRENT_JOBS || "2", 10);
const DEBUG = process.env.DEBUG === "true";

async function main() {
  console.log("Starting worker...");

  const processor = new RecipeProcessor({ maxConcurrentJobs: MAX_CONCURRENT_JOBS, debug: DEBUG });

  process.on("SIGINT", async () => {
    console.log("Shutting down worker...");
    await processor.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("Shutting down worker...");
    await processor.stop();
    process.exit(0);
  });

  await processor.start();
}

main().catch((error) => {
  console.error("Worker failed to start:", error);
  process.exit(1);
});
