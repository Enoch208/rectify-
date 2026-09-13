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
  type CaseState,
  type CaseSummary,
  type GetCaseResponse,
  type ProviderEnvironments,
} from "@rectify/core";
import { runTransaction, type ActionLedger } from "@rectify/core/ledger";
import { z } from "zod";
import { createCaseRecord } from "./case-factory.ts";
import type { StoreContext } from "./context.ts";
import { parseRecordRow, parseRecordRows } from "./database.ts";
import { StatusError } from "./errors.ts";
import type { IntakeEntry } from "./intake.ts";
import type { CaseJobQueue } from "./job-queue.ts";

export type CasePatch = Partial<Omit<CaseRecord, "id" | "version" | "createdAt" | "updatedAt">>;

const environmentsRowSchema = z.object({ environments_json: z.string() });
const idRowSchema = z.object({ id: z.string() });

export class CaseRepository {
  readonly #context: StoreContext;
  readonly #ledger: ActionLedger;
  readonly #jobs: CaseJobQueue;

  constructor(context: StoreContext, ledger: ActionLedger, jobs: CaseJobQueue) {
    this.#context = context;
    this.#ledger = ledger;
    this.#jobs = jobs;
  }

  createOrResume(identity: IntakeEntry, environments: ProviderEnvironments): CaseRecord {
    const row = this.#context.database
      .prepare("SELECT record_json FROM case_records WHERE source_thread_id = ?")
      .get(identity.gmailThreadId);
    if (row !== undefined) {
      return parseRecordRow(row, caseRecordSchema);
    }
    const record = createCaseRecord(
      identity,
      this.#context.createId(),
      this.#context.now().toISOString(),
    );
    this.#context.database
      .prepare("INSERT INTO case_records VALUES (?, ?, ?, ?)")
      .run(record.id, record.sourceThreadId, JSON.stringify(record), JSON.stringify(environments));
    return record;
  }

  getCase(caseId: string): CaseRecord {
    const row = this.#context.database
      .prepare("SELECT record_json FROM case_records WHERE id = ?")
      .get(caseId);
    if (row === undefined) {
      throw new StatusError(404, `Case not found: ${caseId}`);
    }
    return parseRecordRow(row, caseRecordSchema);
  }

  getEnvironments(caseId: string): ProviderEnvironments {
    const row = this.#context.database
      .prepare("SELECT environments_json FROM case_records WHERE id = ?")
      .get(caseId);
    if (row === undefined) {
      throw new StatusError(404, `Case not found: ${caseId}`);
    }
    const json = environmentsRowSchema.parse(row).environments_json;
    return providerEnvironmentsSchema.parse(JSON.parse(json));
  }

  listCases(): CaseSummary[] {
    const rows = this.#context.database.prepare("SELECT id FROM case_records ORDER BY id").all();
    return rows.map((row) => {
      const { id } = idRowSchema.parse(row);
      const record = this.getCase(id);
      return caseSummarySchema.parse({ ...record, environment: this.getEnvironments(id).gmail });
    });
  }

  listByState(state: CaseState): CaseRecord[] {
    return this.listCases()
      .filter((summary) => summary.state === state)
      .map((summary) => this.getCase(summary.id));
  }

  getCaseResponse(caseId: string): GetCaseResponse {
    const record = this.getCase(caseId);
    const records = <Output>(table: string, schema: z.ZodType<Output>) =>
      parseRecordRows(
        this.#context.database
          .prepare(`SELECT record_json FROM ${table} WHERE case_id = ?`)
          .all(caseId),
        schema,
      );
    return getCaseResponseSchema.parse({
      case: record,
      environments: this.getEnvironments(caseId),
      evidence: records("evidence_records", evidenceRecordSchema),
      verifications: records("verification_records", verificationRecordSchema),
      actions: this.#ledger.listCaseActions(caseId),
      approvals: records("approval_records", approvalRecordSchema),
      outcomeEvents: records("outcome_event_records", outcomeEventRecordSchema),
    });
  }

  updateCase(caseId: string, expectedVersion: number, patch: CasePatch): CaseRecord {
    return runTransaction(this.#context.database, () =>
      this.writeInTransaction(caseId, expectedVersion, patch),
    );
  }

  queue(caseId: string, kind: "INVESTIGATE" | "RECHECK"): string {
    return runTransaction(this.#context.database, () => {
      const current = this.getCase(caseId);
      const allowed = kind === "INVESTIGATE" ? ["NEW"] : ["WAITING_ENGINEERING", "NEEDS_HUMAN"];
      if (!allowed.includes(current.state)) {
        throw new StatusError(
          409,
          `${kind.toLowerCase()} is not allowed while case is ${current.state}`,
        );
      }
      if (this.#jobs.hasActiveJob(caseId)) {
        throw new StatusError(409, "A case job is already active");
      }
      this.writeInTransaction(caseId, current.version, {
        state: "INVESTIGATING",
        needsHumanReason: null,
        resumeState: current.state === "NEEDS_HUMAN" ? current.resumeState : null,
      });
      return this.#jobs.enqueue(this.#context.createId(), caseId, kind).id;
    });
  }

  writeInTransaction(caseId: string, expectedVersion: number, patch: CasePatch): CaseRecord {
    const current = this.getCase(caseId);
    if (current.version !== expectedVersion) {
      throw new StatusError(409, `Case ${caseId} changed concurrently`);
    }
    const updated = caseRecordSchema.parse({
      ...current,
      ...patch,
      id: current.id,
      version: current.version + 1,
      createdAt: current.createdAt,
      updatedAt: this.#context.now().toISOString(),
    });
    this.#context.database
      .prepare("UPDATE case_records SET record_json = ? WHERE id = ?")
      .run(JSON.stringify(updated), caseId);
    return updated;
  }
}
