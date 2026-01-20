import type {
  ImportError,
  ImportJob,
  ImportOptions,
  ImportWarning
} from "@ria/domain";
import type { JobRepository } from "@ria/application";
import type { Kysely } from "kysely";
import { asArray, asRecord, isRecord, toJsonValue } from "../db/serialization";
import type { Database } from "../db/types";

const parseImportOptions = (value: unknown): ImportOptions => {
  if (!isRecord(value)) {
    return { llmPolicy: "never", debug: false };
  }

  const llmPolicy = value.llmPolicy;
  const debug = value.debug;

  if (
    (llmPolicy === "never" ||
      llmPolicy === "fallback" ||
      llmPolicy === "always") &&
    typeof debug === "boolean"
  ) {
    return { llmPolicy, debug };
  }

  return { llmPolicy: "never", debug: false };
};

const mapJob = (row: Database["import_jobs"]): ImportJob => ({
  id: row.id,
  userId: row.user_id,
  sourceType: row.source_type,
  payload: asRecord(row.payload),
  options: parseImportOptions(row.options),
  status: row.status,
  progressPct: row.progress_pct,
  currentStep: row.current_step ?? undefined,
  warnings: asArray<ImportWarning>(row.warnings),
  errors: asArray<ImportError>(row.errors),
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString()
});

export class PostgresJobRepository implements JobRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(job: ImportJob): Promise<void> {
    await this.db
      .insertInto("import_jobs")
      .values({
        id: job.id,
        user_id: job.userId,
        source_type: job.sourceType,
        payload: toJsonValue(job.payload, {}),
        options: toJsonValue(job.options, {}),
        status: job.status,
        progress_pct: job.progressPct,
        current_step: job.currentStep ?? null,
        warnings: toJsonValue(job.warnings, []),
        errors: toJsonValue(job.errors, []),
        created_at: new Date(job.createdAt),
        updated_at: new Date(job.updatedAt)
      })
      .execute();
  }

  async update(job: ImportJob): Promise<void> {
    await this.db
      .updateTable("import_jobs")
      .set({
        user_id: job.userId,
        source_type: job.sourceType,
        payload: toJsonValue(job.payload, {}),
        options: toJsonValue(job.options, {}),
        status: job.status,
        progress_pct: job.progressPct,
        current_step: job.currentStep ?? null,
        warnings: toJsonValue(job.warnings, []),
        errors: toJsonValue(job.errors, []),
        updated_at: new Date(job.updatedAt)
      })
      .where("id", "=", job.id)
      .execute();
  }

  async getById(jobId: string): Promise<ImportJob | null> {
    const row = await this.db
      .selectFrom("import_jobs")
      .selectAll()
      .where("id", "=", jobId)
      .executeTakeFirst();

    return row ? mapJob(row) : null;
  }
}
