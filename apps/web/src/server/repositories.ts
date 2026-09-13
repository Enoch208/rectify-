import { ApprovalRepository } from "./approval-repository.ts";
import { CaseRepository } from "./case-repository.ts";
import { requireEnvironment } from "./config.ts";
import { RecordRepository } from "./record-repository.ts";
import { RunRepository } from "./run-repository.ts";

export interface Repositories {
  cases: CaseRepository;
  approvals: ApprovalRepository;
  records: RecordRepository;
  runs: RunRepository;
  close(): void;
}

export const openRepositories = (): Repositories => {
  const path = requireEnvironment("RECTIFY_DB_PATH");
  const cases = new CaseRepository({ path });
  const approvals = new ApprovalRepository(path);
  const records = new RecordRepository(path);
  const runs = new RunRepository(path, cases);
  return {
    cases,
    approvals,
    records,
    runs,
    close: () => {
      runs.close();
      approvals.close();
      records.close();
      cases.close();
    },
  };
};
