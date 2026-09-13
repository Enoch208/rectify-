import type { ActionRecord, VerificationRecord } from "@rectify/core";
import { actionKeys, actionKinds } from "./action-keys.ts";
import { allowed, denied, executeOnce, payloadString } from "./case-flow.ts";
import { impactIssueContent, slackHandoffText } from "./messages.ts";
import type { WorkerServices } from "./services.ts";

export interface HandoffResult {
  issue: ActionRecord;
  handoff: ActionRecord | null;
}

const failingCheckFor = (
  services: WorkerServices,
  caseId: string,
  verification: VerificationRecord,
) => {
  const record = services.store.cases.getCase(caseId);
  if (verification.caseId !== caseId || verification.input.tenantId !== record.tenantId) {
    return denied("Verification does not belong to this case and tenant");
  }
  if (verification.result !== "FAIL") {
    return denied("An engineering handoff requires a failed customer workflow check");
  }
  return allowed;
};

export const ensureEngineeringHandoff = async (
  services: WorkerServices,
  caseId: string,
  verification: VerificationRecord,
): Promise<HandoffResult> => {
  const issueKey = actionKeys.impactIssue(caseId);
  const issue = await executeOnce(
    services,
    () => {
      const record = services.store.cases.getCase(caseId);
      const content = impactIssueContent(record, verification, issueKey);
      return {
        caseId,
        logicalKey: issueKey,
        provider: "github",
        kind: actionKinds.impactIssue,
        payload: { ...content, verificationId: verification.id, tenantId: record.tenantId },
      };
    },
    () => Promise.resolve(failingCheckFor(services, caseId, verification)),
    async (action) => {
      const created = await services.github.createIssue({
        title: payloadString(action, "title"),
        body: payloadString(action, "body"),
      });
      return { providerIds: [String(created.number), created.html_url] };
    },
    issueKey,
  );
  if (issue.status !== "CONFIRMED") {
    return { issue, handoff: null };
  }
  const issueUrl = issue.providerIds[1] ?? issue.providerIds[0] ?? "";
  const handoffKey = actionKeys.slackHandoff(caseId);
  const handoff = await executeOnce(
    services,
    () => {
      const record = services.store.cases.getCase(caseId);
      return {
        caseId,
        logicalKey: handoffKey,
        provider: "slack",
        kind: actionKinds.slackHandoff,
        payload: {
          text: slackHandoffText(record, verification, issueUrl, handoffKey),
          issueUrl,
          verificationId: verification.id,
        },
      };
    },
    () => Promise.resolve(failingCheckFor(services, caseId, verification)),
    async (action) => {
      const message = await services.slack.postMessage({ text: payloadString(action, "text") });
      return { providerIds: [message.ts] };
    },
    handoffKey,
  );
  return { issue, handoff };
};
