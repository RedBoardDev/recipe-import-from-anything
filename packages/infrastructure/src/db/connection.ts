import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { Database } from "./types";

export const getDatabaseUrl = (): string =>
  process.env.DATABASE_URL ??
  "postgres://recipe:recipe@localhost:5432/recipe_import";

export const createDb = (databaseUrl: string = getDatabaseUrl()): Kysely<Database> => {
  const pool = new Pool({ connectionString: databaseUrl });
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool })
  });
};

export const destroyDb = async (db: Kysely<Database>): Promise<void> => {
  await db.destroy();
};
