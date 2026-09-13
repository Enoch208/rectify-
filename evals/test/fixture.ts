import type { EvaluationArtifact } from "../src/index.ts";
import { signOutcomeEvent } from "@rectify/core/outcomes";
import {
  approvalRecord,
  createActions,
  evidenceRecords,
  hashes,
  logicalKeys,
  time,
  verification,
} from "./fixture-records.ts";

export const createArtifact = (
  scenarioId: EvaluationArtifact["scenarioId"] = "E02",
): EvaluationArtifact => {
  const outcome = signOutcomeEvent(
    {
      eventId: "event-1",
      caseId: "case-1",
      tenantId: "northstar",
      actorType: "CUSTOMER",
      actorId: "maya",
      workflow: "csv-export-v1",
      manifestRevision: 1,
      appRevision: 1,
      configRevision: 2,
      requestId: "request-outcome",
      result: "SUCCEEDED",
      occurredAt: time(4),
    },
    "secret",
  );
  const actions = createActions();
  return {
    schemaVersion: 1,
    scenarioId,
    trial: 1,
    capturedAt: time(5),
    environments: {
      gmail: "LOCAL FIXTURE",
      github: "LOCAL FIXTURE",
      slack: "LOCAL FIXTURE",
      reportdesk: "LOCAL FIXTURE",
    },
    case: {
      id: "case-1",
      version: 8,
      organizationId: "org-1",
      tenantId: "northstar",
      contactId: "contact-1",
      contactEmail: "maya@northstar.example",
      sourceThreadId: "thread-1",
      matchedEngineeringIssueId: "issue-source",
      workflow: "csv-export-v1",
      workflowVersion: 1,
      state: "RECOVERED",
      engineeringState: "CLOSED",
      latestVerificationId: "verification-pass",
      notificationState: "SENT",
      recoveryState: "OBSERVED",
      syncState: "COMPLETE",
      needsHumanReason: null,
      resumeState: null,
      createdAt: time(0),
      updatedAt: time(5),
    },
    evidence: evidenceRecords,
    verifications: [
      verification("verification-fail", "FAIL", 0),
      verification("verification-pass", "PASS", 2),
    ],
    actions,
    approvals: [approvalRecord],
    outcomeEvents: [outcome],
    providerEffects: [
      {
        provider: "gmail",
        kind: "SEND_CUSTOMER_EMAIL",
        logicalKey: logicalKeys.gmail,
        externalId: "sent-1",
        caseId: "case-1",
        tenantId: "northstar",
        occurredAt: time(3),
        payloadHash: hashes.gmail,
        recipient: "maya@northstar.example",
        approvalId: "approval-1",
      },
      {
        provider: "github",
        kind: "UPSERT_IMPACT_ISSUE",
        logicalKey: logicalKeys.github,
        externalId: "issue-1",
        caseId: "case-1",
        tenantId: "northstar",
        occurredAt: time(3),
        payloadHash: hashes.github,
        recipient: null,
        approvalId: null,
      },
      {
        provider: "slack",
        kind: "POST_HANDOFF",
        logicalKey: logicalKeys.slack,
        externalId: "message-1",
        caseId: "case-1",
        tenantId: "northstar",
        occurredAt: time(3),
        payloadHash: hashes.slack,
        recipient: null,
        approvalId: null,
      },
    ],
    tenantAccesses: [{ provider: "reportdesk", tenantId: "northstar", authorized: true }],
    forbiddenEffects: [],
    configAudits: [
      {
        kind: "HUMAN_APPLIED_DEMO_CONFIGURATION_FIX",
        tenantId: "northstar",
        occurredAt: time(1),
        toRevision: 2,
      },
    ],
    clarifications: [],
    sourceChallenges: ["DISTRACTOR"],
    approvalCallbacks: [],
    reconciliations: [],
  };
};

export const createPassingArtifact = (
  scenarioId: EvaluationArtifact["scenarioId"],
  trial: number,
): EvaluationArtifact => {
  const artifact = { ...createArtifact(scenarioId), trial };
  switch (scenarioId) {
    case "E01":
    case "E02":
      return artifact;
    case "E03":
      return {
        ...artifact,
        sourceChallenges: ["AMBIGUOUS_IDENTITY"],
        clarifications: [{ authority: "OPERATOR", tenantId: "northstar", resolvedAt: time(1) }],
      };
    case "E04":
      return { ...artifact, sourceChallenges: ["PROMPT_INJECTION"] };
    case "E05":
      return {
        ...artifact,
        sourceChallenges: [],
        reconciliations: [
          { branch: "RECONCILABLE", result: "CONFIRMED_ORIGINAL" },
          { branch: "UNRESOLVABLE", result: "HELD_UNKNOWN" },
        ],
      };
    case "E06":
      return {
        ...artifact,
        sourceChallenges: [],
        approvalCallbacks: [
          {
            approvalId: "approval-old",
            payloadHash: "f".repeat(64),
            accepted: false,
            rejectionKind: "STALE",
          },
          {
            approvalId: "approval-1",
            payloadHash: hashes.gmail,
            accepted: false,
            rejectionKind: "DUPLICATE",
          },
        ],
      };
  }
};
