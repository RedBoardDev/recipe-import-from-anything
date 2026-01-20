import type { JobStatus, SourceType } from "@ria/domain";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface ImportJobsTable {
  id: string;
  user_id: string;
  source_type: SourceType;
  payload: JsonValue;
  options: JsonValue;
  status: JobStatus;
  progress_pct: number;
  current_step: string | null;
  warnings: JsonValue;
  errors: JsonValue;
  created_at: Date;
  updated_at: Date;
}

export interface JobResultsTable {
  job_id: string;
  result: JsonValue;
  created_at: Date;
}

export interface JobStepRunsTable {
  id: string;
  job_id: string;
  step_id: string;
  status: string;
  started_at: Date;
  ended_at: Date | null;
  duration_ms: number | null;
  error: JsonValue | null;
  output_ref: string | null;
  meta: JsonValue | null;
}

export interface Database {
  import_jobs: ImportJobsTable;
  job_results: JobResultsTable;
  job_step_runs: JobStepRunsTable;
}
