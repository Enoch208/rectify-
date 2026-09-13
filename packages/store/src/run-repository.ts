import {
  getRunResponseSchema,
  runRecordSchema,
  type GetRunResponse,
  type RunRecord,
} from "@rectify/core";
import type { CaseRepository } from "./case-repository.ts";
import type { StoreContext } from "./context.ts";
import { parseRecordRow, parseRecordRows } from "./database.ts";
import { StatusError } from "./errors.ts";

export class RunRepository {
  readonly #context: StoreContext;
  readonly #cases: CaseRepository;

  constructor(context: StoreContext, cases: CaseRepository) {
    this.#context = context;
    this.#cases = cases;
  }

  list(): RunRecord[] {
    return parseRecordRows(
      this.#context.database.prepare("SELECT record_json FROM run_records ORDER BY id").all(),
      runRecordSchema,
    );
  }

  save(record: RunRecord): void {
    const parsed = runRecordSchema.parse(record);
    this.#context.database
      .prepare("INSERT OR REPLACE INTO run_records VALUES (?, ?, ?)")
      .run(parsed.id, parsed.caseId, JSON.stringify(parsed));
  }

  get(runId: string): GetRunResponse {
    const row = this.#context.database
      .prepare("SELECT record_json FROM run_records WHERE id = ?")
      .get(runId);
    if (row === undefined) {
      throw new StatusError(404, `Run not found: ${runId}`);
    }
    const run = parseRecordRow(row, runRecordSchema);
    const data = this.#cases.getCaseResponse(run.caseId);
    return getRunResponseSchema.parse({
      run,
      actions: data.actions,
      evidence: data.evidence,
      verifications: data.verifications,
    });
  }
}
