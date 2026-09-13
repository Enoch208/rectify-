import { outcomeEventRecordSchema, type OutcomeEventRecord } from "@rectify/core";
import { runTransaction } from "@rectify/core/ledger";
import type { CaseRepository } from "./case-repository.ts";
import type { StoreContext } from "./context.ts";
import { StatusError } from "./errors.ts";

export class OutcomeRepository {
  readonly #context: StoreContext;
  readonly #cases: CaseRepository;

  constructor(context: StoreContext, cases: CaseRepository) {
    this.#context = context;
    this.#cases = cases;
  }

  saveCustomerOutcome(event: OutcomeEventRecord): void {
    const parsed = outcomeEventRecordSchema.parse(event);
    runTransaction(this.#context.database, () => {
      const duplicate = this.#context.database
        .prepare("SELECT event_id FROM outcome_event_records WHERE event_id = ?")
        .get(parsed.eventId);
      if (duplicate !== undefined) {
        throw new StatusError(409, `Outcome event was already received: ${parsed.eventId}`);
      }
      const current = this.#cases.getCase(parsed.caseId);
      if (current.state !== "WAITING_CUSTOMER") {
        throw new StatusError(
          409,
          `Customer outcome is not allowed while case is ${current.state}`,
        );
      }
      this.#context.database
        .prepare("INSERT INTO outcome_event_records VALUES (?, ?, ?)")
        .run(parsed.eventId, parsed.caseId, JSON.stringify(parsed));
      if (parsed.result === "SUCCEEDED") {
        this.#cases.writeInTransaction(current.id, current.version, {
          state: "RECOVERED",
          recoveryState: "OBSERVED",
          syncState: "PENDING",
        });
      }
    });
  }
}
