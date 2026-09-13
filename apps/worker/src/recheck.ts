import { latestVerification, moveCase, requireHuman } from "./case-flow.ts";
import { saveEvidence } from "./agent-handlers.ts";
import { githubEvidenceInput } from "./evidence.ts";
import { finalizeCaseCheck } from "./finalize.ts";
import { finishRun, startRun } from "./runs.ts";
import type { WorkerServices } from "./services.ts";

export const runRecheck = async (services: WorkerServices, caseId: string): Promise<void> => {
  const run = startRun(services, caseId, "recheck");
  const record = services.store.cases.getCase(caseId);
  const previous = latestVerification(services, record);
  if (previous === null || record.matchedEngineeringIssueId === null) {
    requireHuman(
      services,
      caseId,
      "There is no earlier matched issue and workflow check to repeat. Investigate first.",
      "NEW",
    );
    finishRun(services, run, {
      status: "STOPPED",
      toolCallCount: 0,
      inputTokens: null,
      outputTokens: null,
      stopReason: "Nothing to recheck",
      traceId: null,
    });
    return;
  }
  const issue = await services.github.readIssue(Number(record.matchedEngineeringIssueId));
  saveEvidence(services, caseId, [githubEvidenceInput(issue)]);
  moveCase(services, caseId, { engineeringState: issue.state === "closed" ? "CLOSED" : "OPEN" });
  const verification = await services.reportdesk.verify({
    caseId,
    tenantId: record.tenantId,
    period: previous.input.period,
  });
  services.store.records.saveVerification(verification);
  moveCase(services, caseId, { latestVerificationId: verification.id });
  await finalizeCaseCheck(services, caseId);
  finishRun(services, run, {
    status: "SUCCEEDED",
    toolCallCount: 0,
    inputTokens: null,
    outputTokens: null,
    stopReason: `Deterministic recheck: ${verification.result}`,
    traceId: null,
  });
};
