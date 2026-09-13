import { DatabaseSync } from "node:sqlite";
import {
  getRunResponseSchema,
  runRecordSchema,
  type GetRunResponse,
  type RunRecord,
} from "@rectify/core";
import { z } from "zod";
import type { CaseRepository } from "./case-repository.ts";
import { HttpError } from "./errors.ts";

const rowSchema = z.object({ record_json: z.string() });

const parseRun = (row: unknown): RunRecord => {
  const json = rowSchema.parse(row).record_json;
  return runRecordSchema.parse(JSON.parse(json));
};

export class RunRepository {
  readonly #database: DatabaseSync;
  readonly #cases: CaseRepository;

  constructor(path: string, cases: CaseRepository) {
    this.#database = new DatabaseSync(path, { allowExtension: false });
    this.#database.enableDefensive(true);
    this.#cases = cases;
  }

  close(): void {
    this.#database.close();
  }

  list(): RunRecord[] {
    return this.#database
      .prepare("SELECT record_json FROM run_records ORDER BY id")
      .all()
      .map(parseRun);
  }

  get(runId: string): GetRunResponse {
    const row = this.#database
      .prepare("SELECT record_json FROM run_records WHERE id = ?")
      .get(runId);
    if (row === undefined) {
      throw new HttpError(404, `Run not found: ${runId}`);
    }
    const run = parseRun(row);
    const data = this.#cases.getCaseResponse(run.caseId);
    return getRunResponseSchema.parse({
      run,
      actions: data.actions,
      evidence: data.evidence,
      verifications: data.verifications,
    });
  }
}
