import type { ImportError } from "@ria/domain";
import type { StepRun, StepRunRepository } from "@ria/application";
import { sql } from "kysely";
import type { Kysely } from "kysely";
import { randomUUID } from "node:crypto";
import { asRecord, isRecord, toJsonValue } from "../db/serialization";
import type { Database } from "../db/types";

type StepRunStatus = StepRun["status"];

const parseImportError = (value: unknown): ImportError | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const code = value.code;
  const message = value.message;

  if (typeof code !== "string" || typeof message !== "string") {
    return undefined;
  }

  return {
    code,
    message,
    stepId: typeof value.stepId === "string" ? value.stepId : undefined,
    details: isRecord(value.details) ? value.details : undefined
  };
};

export class PostgresStepRunRepository implements StepRunRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async startRun(jobId: string, stepId: string): Promise<string> {
    const id = randomUUID();

    await this.db
      .insertInto("job_step_runs")
      .values({
        id,
        job_id: jobId,
        step_id: stepId,
        status: "RUNNING",
        started_at: new Date(),
        ended_at: null,
        duration_ms: null,
        error: null,
        output_ref: null,
        meta: null
      })
      .execute();

    return id;
  }

  async finishRun(
    runId: string,
    status: "SUCCEEDED" | "FAILED",
    meta?: Record<string, unknown>
  ): Promise<void> {
    await this.db
      .updateTable("job_step_runs")
      .set({
        status,
        ended_at: sql`now()`,
        duration_ms: sql<number>`(extract(epoch from (now() - started_at)) * 1000)::int`,
        meta: meta ? toJsonValue(meta) : null
      })
      .where("id", "=", runId)
      .execute();
  }

  async failRun(runId: string, error: ImportError): Promise<void> {
    await this.db
      .updateTable("job_step_runs")
      .set({
        status: "FAILED",
        ended_at: sql`now()`,
        duration_ms: sql<number>`(extract(epoch from (now() - started_at)) * 1000)::int`,
        error: toJsonValue(error)
      })
      .where("id", "=", runId)
      .execute();
  }

  async listByJobId(jobId: string): Promise<StepRun[]> {
    const rows = await this.db
      .selectFrom("job_step_runs")
      .selectAll()
      .where("job_id", "=", jobId)
      .orderBy("started_at", "asc")
      .execute();

    return rows.map((row) => ({
      id: row.id,
      jobId: row.job_id,
      stepId: row.step_id,
      status: row.status as StepRunStatus,
      startedAt: row.started_at.toISOString(),
      endedAt: row.ended_at?.toISOString(),
      durationMs: row.duration_ms ?? undefined,
      error: parseImportError(row.error),
      outputRef: row.output_ref ?? undefined,
      meta: row.meta ? asRecord(row.meta) : undefined
    }));
  }
}
