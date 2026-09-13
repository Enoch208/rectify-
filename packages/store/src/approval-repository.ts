import { approvalRecordSchema, type ApprovalRecord } from "@rectify/core";
import { runTransaction } from "@rectify/core/ledger";
import type { StoreContext } from "./context.ts";
import { parseRecordRow, parseRecordRows } from "./database.ts";
import { StatusError } from "./errors.ts";

export class ApprovalRepository {
  readonly #context: StoreContext;

  constructor(context: StoreContext) {
    this.#context = context;
  }

  get(approvalId: string): ApprovalRecord {
    const row = this.#context.database
      .prepare("SELECT record_json FROM approval_records WHERE id = ?")
      .get(approvalId);
    if (row === undefined) {
      throw new StatusError(404, `Approval not found: ${approvalId}`);
    }
    return parseRecordRow(row, approvalRecordSchema);
  }

  save(record: ApprovalRecord): void {
    const parsed = approvalRecordSchema.parse(record);
    this.#context.database
      .prepare("INSERT OR REPLACE INTO approval_records VALUES (?, ?, ?, ?)")
      .run(parsed.id, parsed.caseId, parsed.nonce, JSON.stringify(parsed));
  }

  listForCase(caseId: string): ApprovalRecord[] {
    return parseRecordRows(
      this.#context.database
        .prepare("SELECT record_json FROM approval_records WHERE case_id = ? ORDER BY id")
        .all(caseId),
      approvalRecordSchema,
    );
  }

  listAwaitingDispatch(): ApprovalRecord[] {
    return parseRecordRows(
      this.#context.database
        .prepare(
          `SELECT record_json FROM approval_records
           WHERE json_extract(record_json, '$.decision') IN ('APPROVED', 'REJECTED')
           AND json_extract(record_json, '$.consumedAt') IS NULL
           AND json_extract(record_json, '$.revokedAt') IS NULL
           ORDER BY id`,
        )
        .all(),
      approvalRecordSchema,
    );
  }

  consume(approvalId: string): ApprovalRecord {
    return this.#settle(approvalId, "consumedAt");
  }

  revoke(approvalId: string): ApprovalRecord {
    return this.#settle(approvalId, "revokedAt");
  }

  #settle(approvalId: string, field: "consumedAt" | "revokedAt"): ApprovalRecord {
    return runTransaction(this.#context.database, () => {
      const current = this.get(approvalId);
      if (current.consumedAt !== null || current.revokedAt !== null) {
        throw new StatusError(409, `Approval ${approvalId} was already used or revoked`);
      }
      const updated = approvalRecordSchema.parse({
        ...current,
        [field]: this.#context.now().toISOString(),
      });
      this.save(updated);
      return updated;
    });
  }
}
