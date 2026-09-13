import {
  caseRecordSchema,
  evidenceRecordSchema,
  verificationRecordSchema,
  type CaseRecord,
  type EvidenceRecord,
  type VerificationRecord,
} from "@rectify/core";
import type { StoreContext } from "./context.ts";
import { parseRecordRow } from "./database.ts";
import { StatusError } from "./errors.ts";

export class RecordRepository {
  readonly #context: StoreContext;

  constructor(context: StoreContext) {
    this.#context = context;
  }

  saveCase(record: CaseRecord): void {
    const parsed = caseRecordSchema.parse(record);
    const result = this.#context.database
      .prepare("UPDATE case_records SET record_json = ? WHERE id = ? AND source_thread_id = ?")
      .run(JSON.stringify(parsed), parsed.id, parsed.sourceThreadId);
    if (result.changes !== 1) {
      throw new StatusError(404, `Case not found: ${parsed.id}`);
    }
  }

  saveEvidence(record: EvidenceRecord): void {
    const parsed = evidenceRecordSchema.parse(record);
    this.#context.database
      .prepare("INSERT INTO evidence_records VALUES (?, ?, ?)")
      .run(parsed.id, parsed.caseId, JSON.stringify(parsed));
  }

  saveVerification(record: VerificationRecord): void {
    const parsed = verificationRecordSchema.parse(record);
    this.#context.database
      .prepare("INSERT INTO verification_records VALUES (?, ?, ?)")
      .run(parsed.id, parsed.caseId, JSON.stringify(parsed));
  }

  getVerification(verificationId: string): VerificationRecord {
    const row = this.#context.database
      .prepare("SELECT record_json FROM verification_records WHERE id = ?")
      .get(verificationId);
    if (row === undefined) {
      throw new StatusError(404, `Verification not found: ${verificationId}`);
    }
    return parseRecordRow(row, verificationRecordSchema);
  }
}
