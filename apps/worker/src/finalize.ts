import { prepareCustomerApproval } from "./approval-request.ts";
import { latestVerification, moveCase, requireHuman } from "./case-flow.ts";
import { ensureEngineeringHandoff } from "./handoff.ts";
import type { WorkerServices } from "./services.ts";

export const finalizeCaseCheck = async (
  services: WorkerServices,
  caseId: string,
): Promise<void> => {
  const record = services.store.cases.getCase(caseId);
  if (record.state !== "INVESTIGATING") {
    return;
  }
  if (record.matchedEngineeringIssueId === null) {
    requireHuman(
      services,
      caseId,
      "The investigation did not ground a match to an engineering issue.",
      "NEW",
    );
    return;
  }
  const verification = latestVerification(services, record);
  if (verification === null) {
    requireHuman(services, caseId, "The customer workflow was not checked.", "NEW");
    return;
  }
  switch (verification.result) {
    case "FAIL": {
      const { issue, handoff } = await ensureEngineeringHandoff(services, caseId, verification);
      if (issue.status === "CONFIRMED" && handoff?.status === "CONFIRMED") {
        moveCase(services, caseId, {
          state: "WAITING_ENGINEERING",
          needsHumanReason: null,
          resumeState: null,
        });
        return;
      }
      requireHuman(
        services,
        caseId,
        `Engineering handoff is incomplete: impact issue ${issue.status}, Slack handoff ${handoff?.status ?? "NOT_STARTED"}.`,
        "WAITING_ENGINEERING",
      );
      return;
    }
    case "INCONCLUSIVE":
      requireHuman(
        services,
        caseId,
        `The export check was inconclusive (${verification.observed.failureReason ?? "no reason"}). No customer message is prepared.`,
        "WAITING_ENGINEERING",
      );
      return;
    case "PASS": {
      const preparation = await prepareCustomerApproval(services, caseId, verification);
      if (!preparation.ready) {
        requireHuman(services, caseId, preparation.reason, "WAITING_ENGINEERING");
      }
      return;
    }
  }
};
