import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  approvalRecordSchema,
  caseRecordSchema,
  caseSummarySchema,
  evidenceRecordSchema,
  getCaseResponseSchema,
  outcomeEventRecordSchema,
  providerEnvironmentsSchema,
  verificationRecordSchema,
  type CaseRecord,
  type GetCaseResponse,
  type OutcomeEventRecord,
  type ProviderEnvironments,
} from "@rectify/core";
import { ActionLedger, runTransaction } from "@rectify/core/ledger";
import { z } from "zod";
import { createCaseRecord } from "./case-factory.ts";
import type { IntakeEntry } from "./config.ts";
import { migrateCaseDatabase } from "./database.ts";
import { HttpError } from "./errors.ts";

const recordRowSchema = z.object({ record_json: z.string() });

const parseRecord = <Output>(row: unknown, schema: z.ZodType<Output>): Output => {
  const { record_json: json } = recordRowSchema.parse(row);
  const decoded: unknown = JSON.parse(json);
  return schema.parse(decoded);
};

const parseRecords = <Output>(rows: readonly unknown[], schema: z.ZodType<Output>): Output[] =>
  rows.map((row) => parseRecord(row, schema));

export interface CaseRepositoryOptions {
  path: string;
  now?: () => Date;
  createId?: () => string;
}

export class CaseRepository {
  readonly #database: DatabaseSync;
  readonly #ledger: ActionLedger;
  readonly #now: () => Date;
  readonly #createId: () => string;

  constructor(options: CaseRepositoryOptions) {
    this.#database = new DatabaseSync(options.path, { allowExtension: false });
    this.#ledger = new ActionLedger({
      path: options.path,
      ...(options.now === undefined ? {} : { now: options.now }),
      ...(options.createId === undefined ? {} : { createId: options.createId }),
    });
    this.#now = options.now ?? (() => new Date());
    this.#createId = options.createId ?? randomUUID;
    migrateCaseDatabase(this.#database);
    this.#database.enableDefensive(true);
  }

  close(): void {
    this.#ledger.close();
    this.#database.close();
  }

  createOrResume(identity: IntakeEntry, environments: ProviderEnvironments): CaseRecord {
    const row = this.#database
      .prepare("SELECT record_json FROM case_records WHERE source_thread_id = ?")
      .get(identity.gmailThreadId);
    if (row !== undefined) {
      return parseRecord(row, caseRecordSchema);
    }
    const record = createCaseRecord(identity, this.#createId(), this.#now().toISOString());
    this.#database
      .prepare("INSERT INTO case_records VALUES (?, ?, ?, ?)")
      .run(record.id, record.sourceThreadId, JSON.stringify(record), JSON.stringify(environments));
    return record;
  }

  getCase(caseId: string): CaseRecord {
    const row = this.#database
      .prepare("SELECT record_json FROM case_records WHERE id = ?")
      .get(caseId);
    if (row === undefined) {
      throw new HttpError(404, `Case not found: ${caseId}`);
    }
    return parseRecord(row, caseRecordSchema);
  }

  listCases() {
    const rows = this.#database
      .prepare("SELECT record_json, environments_json FROM case_records ORDER BY id")
      .all();
    return rows.map((row) => {
      const parsed = z
        .object({ record_json: z.string(), environments_json: z.string() })
        .parse(row);
      const record = caseRecordSchema.parse(JSON.parse(parsed.record_json));
      const environments = providerEnvironmentsSchema.parse(JSON.parse(parsed.environments_json));
      return caseSummarySchema.parse({ ...record, environment: environments.gmail });
    });
  }

  getCaseResponse(caseId: string): GetCaseResponse {
    const record = this.getCase(caseId);
    const environmentRow = this.#database
      .prepare("SELECT environments_json FROM case_records WHERE id = ?")
      .get(caseId);
    const environments = providerEnvironmentsSchema.parse(
      JSON.parse(
        z.object({ environments_json: z.string() }).parse(environmentRow).environments_json,
      ),
    );
    const records = <Output>(table: string, schema: z.ZodType<Output>) =>
      parseRecords(
        this.#database.prepare(`SELECT record_json FROM ${table} WHERE case_id = ?`).all(caseId),
        schema,
      );
    return getCaseResponseSchema.parse({
      case: record,
      environments,
      evidence: records("evidence_records", evidenceRecordSchema),
      verifications: records("verification_records", verificationRecordSchema),
      actions: this.#ledger.listCaseActions(caseId),
      approvals: records("approval_records", approvalRecordSchema),
      outcomeEvents: records("outcome_event_records", outcomeEventRecordSchema),
    });
  }

  queue(caseId: string, kind: "INVESTIGATE" | "RECHECK"): string {
    return runTransaction(this.#database, () => {
      const current = this.getCase(caseId);
      const allowed = kind === "INVESTIGATE" ? ["NEW"] : ["WAITING_ENGINEERING", "NEEDS_HUMAN"];
      if (!allowed.includes(current.state)) {
        throw new HttpError(
          409,
          `${kind.toLowerCase()} is not allowed while case is ${current.state}`,
        );
      }
      const active = this.#database
        .prepare("SELECT id FROM case_jobs WHERE case_id = ? AND status IN ('QUEUED', 'RUNNING')")
        .get(caseId);
      if (active !== undefined) {
        throw new HttpError(409, "A case job is already active");
      }
      const id = this.#createId();
      const timestamp = this.#now().toISOString();
      const updated = caseRecordSchema.parse({
        ...current,
        version: current.version + 1,
        state: "INVESTIGATING",
        needsHumanReason: null,
        resumeState: null,
        updatedAt: timestamp,
      });
      this.#database
        .prepare("UPDATE case_records SET record_json = ? WHERE id = ?")
        .run(JSON.stringify(updated), caseId);
      this.#database
        .prepare("INSERT INTO case_jobs VALUES (?, ?, ?, 'QUEUED', ?)")
        .run(id, caseId, kind, timestamp);
      return id;
    });
  }

  saveOutcome(event: OutcomeEventRecord): void {
    const parsed = outcomeEventRecordSchema.parse(event);
    runTransaction(this.#database, () => {
      const duplicate = this.#database
        .prepare("SELECT event_id FROM outcome_event_records WHERE event_id = ?")
        .get(parsed.eventId);
      if (duplicate !== undefined) {
        throw new HttpError(409, `Outcome event was already received: ${parsed.eventId}`);
      }
      const current = this.getCase(parsed.caseId);
      if (current.state !== "WAITING_CUSTOMER") {
        throw new HttpError(409, `Customer outcome is not allowed while case is ${current.state}`);
      }
      this.#database
        .prepare("INSERT INTO outcome_event_records VALUES (?, ?, ?)")
        .run(parsed.eventId, parsed.caseId, JSON.stringify(parsed));
      if (parsed.result === "SUCCEEDED") {
        const updated = caseRecordSchema.parse({
          ...current,
          version: current.version + 1,
          state: "RECOVERED",
          recoveryState: "OBSERVED",
          syncState: "PENDING",
          updatedAt: this.#now().toISOString(),
        });
        this.#database
          .prepare("UPDATE case_records SET record_json = ? WHERE id = ?")
          .run(JSON.stringify(updated), current.id);
      }
    });
  }
}
