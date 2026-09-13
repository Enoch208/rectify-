import { ActionLedger } from "@rectify/core/ledger";
import { ApprovalRepository } from "./approval-repository.ts";
import { CaseRepository } from "./case-repository.ts";
import { ClarificationRepository } from "./clarification-repository.ts";
import { openStoreContext, type StoreOptions } from "./context.ts";
import { CaseJobQueue } from "./job-queue.ts";
import { OutcomeRepository } from "./outcome-repository.ts";
import { RecordRepository } from "./record-repository.ts";
import { RunRepository } from "./run-repository.ts";

export interface Store {
  readonly ledger: ActionLedger;
  readonly jobs: CaseJobQueue;
  readonly cases: CaseRepository;
  readonly records: RecordRepository;
  readonly approvals: ApprovalRepository;
  readonly outcomes: OutcomeRepository;
  readonly runs: RunRepository;
  readonly clarifications: ClarificationRepository;
  close(): void;
}

export const openStore = (options: StoreOptions): Store => {
  const context = openStoreContext(options);
  const ledger = new ActionLedger({
    path: context.path,
    now: context.now,
    createId: context.createId,
  });
  const jobs = new CaseJobQueue(context.database, context.now);
  const cases = new CaseRepository(context, ledger, jobs);
  return {
    ledger,
    jobs,
    cases,
    records: new RecordRepository(context),
    approvals: new ApprovalRepository(context),
    outcomes: new OutcomeRepository(context, cases),
    runs: new RunRepository(context, cases),
    clarifications: new ClarificationRepository(context),
    close: () => {
      ledger.close();
      context.database.close();
    },
  };
};
