import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { default: pgMigrate } = require("node-pg-migrate") as typeof import("node-pg-migrate");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "../../migrations");

export const runMigrations = async (databaseUrl: string): Promise<void> => {
  await pgMigrate({
    databaseUrl,
    dir: migrationsDir,
    migrationsTable: "pgmigrations",
    direction: "up",
    count: Infinity,
    verbose: false,
    noLock: true,
    ignorePattern: "\\.test\\."
  });
};
