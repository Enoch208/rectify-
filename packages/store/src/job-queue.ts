import type { DatabaseSync } from "node:sqlite";
import { runTransaction } from "@rectify/core/ledger";
import { z } from "zod";

export const caseJobSchema = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1),
  kind: z.enum(["INVESTIGATE", "RECHECK"]),
  status: z.enum(["QUEUED", "RUNNING", "FINISHED", "FAILED"]),
  attempts: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  error: z.string().nullable(),
});

export type CaseJob = z.infer<typeof caseJobSchema>;

const jobRowSchema = z.object({
  id: z.string(),
  case_id: z.string(),
  kind: z.string(),
  status: z.string(),
  attempts: z.number(),
  created_at: z.string(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  error: z.string().nullable(),
});

const parseJob = (row: unknown): CaseJob => {
  const parsed = jobRowSchema.parse(row);
  return caseJobSchema.parse({
    id: parsed.id,
    caseId: parsed.case_id,
    kind: parsed.kind,
    status: parsed.status,
    attempts: parsed.attempts,
    createdAt: parsed.created_at,
    startedAt: parsed.started_at,
    finishedAt: parsed.finished_at,
    error: parsed.error,
  });
};

export class CaseJobQueue {
  readonly #database: DatabaseSync;
  readonly #now: () => Date;

  constructor(database: DatabaseSync, now: () => Date) {
    this.#database = database;
    this.#now = now;
  }

  enqueue(id: string, caseId: string, kind: CaseJob["kind"]): CaseJob {
    this.#database
      .prepare(
        "INSERT INTO case_jobs (id, case_id, kind, status, attempts, created_at) VALUES (?, ?, ?, 'QUEUED', 0, ?)",
      )
      .run(id, caseId, kind, this.#now().toISOString());
    return this.get(id);
  }

  get(id: string): CaseJob {
    const row = this.#database.prepare("SELECT * FROM case_jobs WHERE id = ?").get(id);
    if (row === undefined) {
      throw new Error(`Case job not found: ${id}`);
    }
    return parseJob(row);
  }

  hasActiveJob(caseId: string): boolean {
    const row = this.#database
      .prepare("SELECT id FROM case_jobs WHERE case_id = ? AND status IN ('QUEUED', 'RUNNING')")
      .get(caseId);
    return row !== undefined;
  }

  claimNext(): CaseJob | null {
    return runTransaction(this.#database, () => {
      const row = this.#database
        .prepare("SELECT id FROM case_jobs WHERE status = 'QUEUED' ORDER BY created_at LIMIT 1")
        .get();
      if (row === undefined) {
        return null;
      }
      const { id } = z.object({ id: z.string() }).parse(row);
      this.#database
        .prepare(
          "UPDATE case_jobs SET status = 'RUNNING', attempts = attempts + 1, started_at = ? WHERE id = ? AND status = 'QUEUED'",
        )
        .run(this.#now().toISOString(), id);
      return this.get(id);
    });
  }

  finish(id: string): CaseJob {
    this.#settle(id, "FINISHED", null);
    return this.get(id);
  }

  fail(id: string, reason: string): CaseJob {
    this.#settle(id, "FAILED", reason);
    return this.get(id);
  }

  requeueInterrupted(maxAttempts: number): CaseJob[] {
    const rows = this.#database
      .prepare("SELECT * FROM case_jobs WHERE status = 'RUNNING' ORDER BY created_at")
      .all();
    return rows.map(parseJob).map((job) => {
      if (job.attempts >= maxAttempts) {
        return this.fail(job.id, "Worker stopped during this job too many times");
      }
      this.#database
        .prepare("UPDATE case_jobs SET status = 'QUEUED' WHERE id = ? AND status = 'RUNNING'")
        .run(job.id);
      return this.get(job.id);
    });
  }

  #settle(id: string, status: "FINISHED" | "FAILED", error: string | null): void {
    const result = this.#database
      .prepare(
        "UPDATE case_jobs SET status = ?, finished_at = ?, error = ? WHERE id = ? AND status = 'RUNNING'",
      )
      .run(status, this.#now().toISOString(), error, id);
    if (result.changes !== 1) {
      throw new Error(`Case job is not running: ${id}`);
    }
  }
}
