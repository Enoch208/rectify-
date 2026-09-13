import type {
  ActionRecord,
  ApprovalRecord,
  EvidenceRecord,
  VerificationRecord,
} from "@rectify/core";

export const time = (minute: number): string =>
  `2026-09-13T12:${String(minute).padStart(2, "0")}:00.000Z`;

export const hashes = {
  gmail: "a".repeat(64),
  github: "b".repeat(64),
  slack: "c".repeat(64),
};

export const logicalKeys = {
  gmail: "case-1:gmail:send",
  github: "case-1:github:impact",
  slack: "case-1:slack:handoff",
};

const action = (
  provider: "gmail" | "github" | "slack",
  id: string,
  externalId: string,
): ActionRecord => ({
  id,
  caseId: "case-1",
  version: 1,
  logicalKey: logicalKeys[provider],
  provider,
  kind: `EFFECT_${provider}`,
  payload: { caseId: "case-1" },
  payloadHash: hashes[provider],
  status: "CONFIRMED",
  attempts: [
    {
      number: 1,
      startedAt: time(3),
      finishedAt: time(3),
      outcome: "CONFIRMED",
      error: null,
    },
  ],
  providerIds: [externalId],
  uncertaintyReason: null,
  error: null,
  createdAt: time(2),
  updatedAt: time(3),
});

export const createActions = (): ActionRecord[] => [
  action("gmail", "action-gmail", "sent-1"),
  action("github", "action-github", "issue-1"),
  action("slack", "action-slack", "message-1"),
];

export const verification = (
  id: string,
  result: "FAIL" | "PASS",
  minute: number,
): VerificationRecord => ({
  id,
  caseId: "case-1",
  contractVersion: "csv-export-v1",
  input: {
    tenantId: "northstar",
    period: "2026-08",
    manifestRevision: 1,
    appRevision: 1,
    configRevision: result === "FAIL" ? 1 : 2,
    probeCredentialId: "probe-1",
  },
  requestId: `request-${id}`,
  expected: {
    schema: ["record_id", "tenant_id", "period", "amount", "status"],
    rows: [
      {
        recordId: "record-1",
        tenantId: "northstar",
        period: "2026-08",
        amount: "42.00",
        status: "settled",
      },
    ],
  },
  observed: {
    httpStatus: 200,
    schema: ["record_id", "tenant_id", "period", "amount", "status"],
    rows:
      result === "PASS"
        ? [
            {
              recordId: "record-1",
              tenantId: "northstar",
              period: "2026-08",
              amount: "42.00",
              status: "settled",
            },
          ]
        : [],
    failureReason: result === "FAIL" ? "Expected one record but observed zero" : null,
  },
  responseHash: "d".repeat(64),
  normalizedContentHash: "e".repeat(64),
  result,
  verifiedAt: time(minute),
});

export const approvalRecord: ApprovalRecord = {
  id: "approval-1",
  caseId: "case-1",
  caseVersion: 5,
  actionId: "action-gmail",
  actionVersion: 1,
  actionHash: hashes.gmail,
  providerAccountId: "gmail-1",
  draftId: "draft-1",
  threadId: "thread-1",
  sender: "support@reportdesk.example",
  recipients: ["maya@northstar.example"],
  subject: "Your CSV export",
  body: "Please retry your export.",
  approvedMime: "bWltZQ==",
  businessFieldsHash: hashes.gmail,
  verificationId: "verification-pass",
  appRevision: 1,
  configRevision: 2,
  policyVersion: "policy-1",
  approverId: "approver-1",
  slackWorkspaceId: "workspace-1",
  slackChannelId: "channel-1",
  slackMessageId: "message-approval",
  nonce: "nonce-1",
  decision: "APPROVED",
  expiresAt: time(7),
  consumedAt: time(3),
  revokedAt: null,
  createdAt: time(2),
};

export const evidenceRecords: EvidenceRecord[] = [
  {
    id: "evidence-gmail",
    caseId: "case-1",
    provider: "gmail",
    sourceId: "thread-1",
    sourceUrl: null,
    retrievedAt: time(0),
    factKind: "REPORTED",
    fact: "Customer reports an empty export",
    redactedContent: "Monthly export is empty",
    contentHash: "1".repeat(64),
    environment: "LOCAL FIXTURE",
  },
  {
    id: "evidence-github",
    caseId: "case-1",
    provider: "github",
    sourceId: "issue-source",
    sourceUrl: null,
    retrievedAt: time(0),
    factKind: "REPORTED",
    fact: "The engineering issue is closed",
    redactedContent: "Closed issue",
    contentHash: "2".repeat(64),
    environment: "LOCAL FIXTURE",
  },
  {
    id: "evidence-slack",
    caseId: "case-1",
    provider: "slack",
    sourceId: "message-source",
    sourceUrl: null,
    retrievedAt: time(0),
    factKind: "REPORTED",
    fact: "A rollout was reported complete",
    redactedContent: "Rollout complete",
    contentHash: "3".repeat(64),
    environment: "LOCAL FIXTURE",
  },
];
