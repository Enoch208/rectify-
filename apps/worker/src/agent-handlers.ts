import type { AgentToolHandlers } from "@rectify/agent";
import type { EvidenceRecord } from "@rectify/core";
import { latestVerification, moveCase } from "./case-flow.ts";
import {
  buildEvidence,
  githubEvidenceInput,
  gmailEvidenceInputs,
  slackEvidenceInput,
} from "./evidence.ts";
import { ensureEngineeringHandoff } from "./handoff.ts";
import type { WorkerServices } from "./services.ts";

type EvidenceInput = Parameters<typeof buildEvidence>[2];

export const saveEvidence = (
  services: WorkerServices,
  caseId: string,
  inputs: readonly EvidenceInput[],
): EvidenceRecord[] => {
  const record = services.store.cases.getCase(caseId);
  const environments = services.store.cases.getEnvironments(caseId);
  return inputs.map((input) => {
    const evidence = buildEvidence(
      record,
      environments,
      input,
      services.createId(),
      services.now().toISOString(),
    );
    services.store.records.saveEvidence(evidence);
    return evidence;
  });
};

export const createInvestigationHandlers = (
  services: WorkerServices,
  caseId: string,
): AgentToolHandlers => {
  const scoped = (requested: string) => {
    if (requested !== caseId) {
      throw new Error("Tools may only act on the active case");
    }
    return services.store.cases.getCase(caseId);
  };

  return {
    getCase: ({ caseId: requested }) => Promise.resolve(scoped(requested)),
    readGmailThread: async ({ caseId: requested, threadId }) => {
      const record = scoped(requested);
      if (threadId !== record.sourceThreadId) {
        throw new Error("Only the case's own Gmail thread can be read");
      }
      const thread = await services.gmail.readThread(threadId);
      return saveEvidence(
        services,
        caseId,
        gmailEvidenceInputs(thread, services.gmail.mode === "live"),
      );
    },
    listGitHubIssues: async ({ caseId: requested }) => {
      scoped(requested);
      const issues = await services.github.listIssues();
      return issues.slice(0, 30).map((issue) => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        labels: issue.labels,
      }));
    },
    readGitHubIssue: async ({ caseId: requested, issueNumber }) => {
      scoped(requested);
      const issue = await services.github.readIssue(issueNumber);
      return saveEvidence(services, caseId, [githubEvidenceInput(issue)]);
    },
    selectEngineeringIssue: async ({ caseId: requested, issueNumber }) => {
      scoped(requested);
      const grounded = services.store.cases
        .getCaseResponse(caseId)
        .evidence.some(
          (item) => item.provider === "github" && item.sourceId === String(issueNumber),
        );
      if (!grounded) {
        throw new Error("Read the issue as evidence before selecting it");
      }
      const issue = await services.github.readIssue(issueNumber);
      return moveCase(services, caseId, {
        matchedEngineeringIssueId: String(issue.number),
        engineeringState: issue.state === "closed" ? "CLOSED" : "OPEN",
      });
    },
    readSlackMessages: async ({ caseId: requested, limit }) => {
      scoped(requested);
      const messages = await services.slack.readMessages(limit);
      const readable = messages.filter((message) => message.text.trim().length > 0);
      return saveEvidence(services, caseId, readable.map(slackEvidenceInput));
    },
    verifyCsvExport: async ({ caseId: requested, period }) => {
      const record = scoped(requested);
      const verification = await services.reportdesk.verify({
        caseId,
        tenantId: record.tenantId,
        period,
      });
      services.store.records.saveVerification(verification);
      moveCase(services, caseId, { latestVerificationId: verification.id });
      return verification;
    },
    proposeAction: async ({ caseId: requested, kind }) => {
      const record = scoped(requested);
      const verification = latestVerification(services, record);
      if (verification?.result !== "FAIL") {
        throw new Error(`${kind} requires the latest workflow check to have failed`);
      }
      const { issue, handoff } = await ensureEngineeringHandoff(services, caseId, verification);
      return kind === "POST_SLACK_HANDOFF" && handoff !== null ? handoff : issue;
    },
    requestHuman: ({ caseId: requested, reason, resumeState }) => {
      scoped(requested);
      return Promise.resolve(
        moveCase(services, caseId, {
          state: "NEEDS_HUMAN",
          needsHumanReason: `Agent requested review: ${reason}`.slice(0, 1_000),
          resumeState,
        }),
      );
    },
  };
};
