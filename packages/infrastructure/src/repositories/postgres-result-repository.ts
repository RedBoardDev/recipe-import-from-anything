import type { ImportResult } from "@ria/domain";
import type { ResultRepository } from "@ria/application";
import type { Kysely } from "kysely";
import { asRecord, isRecord, toJsonValue } from "../db/serialization";
import type { Database } from "../db/types";

const parseImportResult = (value: unknown): ImportResult | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !("recipe" in value) ||
    !("confidence" in value) ||
    !("evidence" in value) ||
    !("meta" in value)
  ) {
    return null;
  }

  return value as unknown as ImportResult;
};

export class PostgresResultRepository implements ResultRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async save(jobId: string, result: ImportResult): Promise<void> {
    await this.db
      .insertInto("job_results")
      .values({
        job_id: jobId,
        result: toJsonValue(result),
        created_at: new Date()
      })
      .onConflict((conflict) =>
        conflict.column("job_id").doUpdateSet({
          result: toJsonValue(result),
          created_at: new Date()
        })
      )
      .execute();
  }

  async getByJobId(jobId: string): Promise<ImportResult | null> {
    const row = await this.db
      .selectFrom("job_results")
      .select(["result"])
      .where("job_id", "=", jobId)
      .executeTakeFirst();

    return row ? parseImportResult(asRecord(row.result)) : null;
  }
}
