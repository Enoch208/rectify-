import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

export const migrateCaseDatabase = (database: DatabaseSync): void => {
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS case_records (
      id TEXT PRIMARY KEY,
      source_thread_id TEXT NOT NULL UNIQUE,
      record_json TEXT NOT NULL,
      environments_json TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS evidence_records (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES case_records(id),
      record_json TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS verification_records (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES case_records(id),
      record_json TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS approval_records (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES case_records(id),
      nonce TEXT NOT NULL UNIQUE,
      record_json TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS outcome_event_records (
      event_id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES case_records(id),
      record_json TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS run_records (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES case_records(id),
      record_json TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS case_jobs (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES case_records(id),
      kind TEXT NOT NULL CHECK (kind IN ('INVESTIGATE', 'RECHECK')),
      status TEXT NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'FINISHED', 'FAILED')),
      attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      created_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      error TEXT
    ) STRICT;
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_case_job
    ON case_jobs(case_id) WHERE status IN ('QUEUED', 'RUNNING');
    CREATE TABLE IF NOT EXISTS tenant_clarifications (
      gmail_thread_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      resolved_at TEXT NOT NULL
    ) STRICT;
  `);
};

const recordRowSchema = z.object({ record_json: z.string() });

export const parseRecordRow = <Output>(row: unknown, schema: z.ZodType<Output>): Output => {
  const { record_json: json } = recordRowSchema.parse(row);
  const decoded: unknown = JSON.parse(json);
  return schema.parse(decoded);
};

export const parseRecordRows = <Output>(
  rows: readonly unknown[],
  schema: z.ZodType<Output>,
): Output[] => rows.map((row) => parseRecordRow(row, schema));
