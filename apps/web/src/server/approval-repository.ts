import { DatabaseSync } from "node:sqlite";
import { approvalRecordSchema, type ApprovalRecord } from "@rectify/core";
import { z } from "zod";
import { HttpError } from "./errors.ts";

const rowSchema = z.object({ record_json: z.string() });

export class ApprovalRepository {
  readonly #database: DatabaseSync;

  constructor(path: string) {
    this.#database = new DatabaseSync(path, { allowExtension: false });
    this.#database.enableDefensive(true);
  }

  close(): void {
    this.#database.close();
  }

  get(approvalId: string): ApprovalRecord {
    const row = this.#database
      .prepare("SELECT record_json FROM approval_records WHERE id = ?")
      .get(approvalId);
    if (row === undefined) {
      throw new HttpError(404, `Approval not found: ${approvalId}`);
    }
    const json = rowSchema.parse(row).record_json;
    return approvalRecordSchema.parse(JSON.parse(json));
  }

  save(record: ApprovalRecord): void {
    const parsed = approvalRecordSchema.parse(record);
    this.#database
      .prepare("INSERT OR REPLACE INTO approval_records VALUES (?, ?, ?, ?)")
      .run(parsed.id, parsed.caseId, parsed.nonce, JSON.stringify(parsed));
  }
}
