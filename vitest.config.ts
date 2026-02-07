import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const resolvePath = (path: string): string => resolve(rootDir, path);

export default defineConfig({
  resolve: {
    alias: [
      { find: "@recipe/domain", replacement: resolvePath("packages/domain/src/index.ts") },
      {
        find: "@recipe/pipeline-contracts",
        replacement: resolvePath("packages/pipeline-contracts/src/index.ts"),
      },
      {
        find: "@recipe/pipeline-text/meta",
        replacement: resolvePath("packages/pipelines/text/src/meta.ts"),
      },
      {
        find: "@recipe/pipeline-text/runtime",
        replacement: resolvePath("packages/pipelines/text/src/runtime.ts"),
      },
      {
        find: "@recipe/pipeline-text",
        replacement: resolvePath("packages/pipelines/text/src/index.ts"),
      },
      {
        find: "@recipe/pipeline-url/meta",
        replacement: resolvePath("packages/pipelines/url/src/meta.ts"),
      },
      {
        find: "@recipe/pipeline-url/runtime",
        replacement: resolvePath("packages/pipelines/url/src/runtime.ts"),
      },
      {
        find: "@recipe/pipeline-url",
        replacement: resolvePath("packages/pipelines/url/src/index.ts"),
      },
    ],
    conditions: ["development", "module", "node", "default"],
  },
  test: {
    globals: true,
    include: ["**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
