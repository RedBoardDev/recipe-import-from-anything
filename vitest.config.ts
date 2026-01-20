import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      "@ria/domain": path.resolve(__dirname, "packages/domain/src/index.ts"),
      "@ria/application": path.resolve(__dirname, "packages/application/src/index.ts"),
      "@ria/pipelines": path.resolve(__dirname, "packages/pipelines/src/index.ts"),
      "@ria/infrastructure": path.resolve(__dirname, "packages/infrastructure/src/index.ts")
    }
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true
      }
    }
  }
});
