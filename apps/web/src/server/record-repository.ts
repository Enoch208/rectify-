import { DatabaseSync } from "node:sqlite";
import {
  caseRecordSchema,
  evidenceRecordSchema,
  runRecordSchema,
  verificationRecordSchema,
  type CaseRecord,
  type EvidenceRecord,
  type RunRecord,
  type VerificationRecord,
} from "@rectify/core";
import { HttpError } from "./errors.ts";

export class RecordRepository {
  readonly #database: DatabaseSync;

  constructor(path: string) {
    this.#database = new DatabaseSync(path, { allowExtension: false });
    this.#database.enableDefensive(true);
  }

  close(): void {
    this.#database.close();
  }

  saveCase(record: CaseRecord): void {
    const parsed = caseRecordSchema.parse(record);
    const result = this.#database
      .prepare("UPDATE case_records SET record_json = ? WHERE id = ? AND source_thread_id = ?")
      .run(JSON.stringify(parsed), parsed.id, parsed.sourceThreadId);
    if (result.changes !== 1) {
      throw new HttpError(404, `Case not found: ${parsed.id}`);
    }
  }

  saveEvidence(record: EvidenceRecord): void {
    const parsed = evidenceRecordSchema.parse(record);
    this.#database
      .prepare("INSERT INTO evidence_records VALUES (?, ?, ?)")
      .run(parsed.id, parsed.caseId, JSON.stringify(parsed));
  }

  saveVerification(record: VerificationRecord): void {
    const parsed = verificationRecordSchema.parse(record);
    this.#database
      .prepare("INSERT INTO verification_records VALUES (?, ?, ?)")
      .run(parsed.id, parsed.caseId, JSON.stringify(parsed));
  }

  saveRun(record: RunRecord): void {
    const parsed = runRecordSchema.parse(record);
    this.#database
      .prepare("INSERT INTO run_records VALUES (?, ?, ?)")
      .run(parsed.id, parsed.caseId, JSON.stringify(parsed));
  }
}
