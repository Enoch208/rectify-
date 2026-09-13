import type {
  ApprovalRecord,
  CaseRecord,
  OutcomeEventRecord,
  ProviderEnvironments,
  VerificationRecord,
} from "@rectify/core";

export const now = new Date("2026-09-13T12:00:00.000Z");
export const fixtureHash = "a".repeat(64);

export const environments: ProviderEnvironments = {
  gmail: "LOCAL FIXTURE",
  github: "LOCAL FIXTURE",
  slack: "LOCAL FIXTURE",
  reportdesk: "LOCAL FIXTURE",
};

export const identity = {
  gmailThreadId: "thread-1",
  organizationId: "org-1",
  tenantId: "northstar",
  contactId: "contact-1",
  contactEmail: "maya@northstar.example",
};

export const passingVerification = (caseId: string): VerificationRecord => ({
  id: "verification-1",
  caseId,
  contractVersion: "csv-export-v1",
  input: {
    tenantId: "northstar",
    period: "2026-08",
    manifestRevision: 1,
    appRevision: 1,
    configRevision: 2,
    probeCredentialId: "probe-1",
  },
  requestId: "request-1",
  expected: {
    schema: ["record_id", "tenant_id", "period", "amount", "status"],
    rows: [],
  },
  observed: {
    httpStatus: 200,
    schema: ["record_id", "tenant_id", "period", "amount", "status"],
    rows: [],
    failureReason: null,
  },
  responseHash: fixtureHash,
  normalizedContentHash: fixtureHash,
  result: "PASS",
  verifiedAt: now.toISOString(),
});

export const waitingCustomerCase = (record: CaseRecord): CaseRecord => ({
  ...record,
  version: record.version + 1,
  state: "WAITING_CUSTOMER",
  latestVerificationId: "verification-1",
  notificationState: "SENT",
});

export const approval: ApprovalRecord = {
  id: "approval-1",
  caseId: "case-1",
  caseVersion: 1,
  actionId: "action-1",
  actionVersion: 1,
  actionHash: fixtureHash,
  providerAccountId: "gmail-1",
  draftId: "draft-1",
  threadId: "thread-1",
  sender: "support@reportdesk.example",
  recipients: ["maya@northstar.example"],
  subject: "Your CSV export",
  body: "Please retry your export.",
  approvedMime: "bWltZQ==",
  businessFieldsHash: fixtureHash,
  verificationId: "verification-1",
  appRevision: 1,
  configRevision: 2,
  policyVersion: "policy-1",
  approverId: null,
  slackWorkspaceId: "workspace-1",
  slackChannelId: "channel-1",
  slackMessageId: "100.200",
  nonce: "nonce-1",
  decision: "PENDING",
  expiresAt: "2026-09-13T12:05:00.000Z",
  consumedAt: null,
  revokedAt: null,
  createdAt: now.toISOString(),
};

export const unsignedOutcome = (caseId: string): Omit<OutcomeEventRecord, "signature"> => ({
  eventId: "event-1",
  caseId,
  tenantId: "northstar",
  actorType: "CUSTOMER",
  actorId: "maya",
  workflow: "csv-export-v1",
  manifestRevision: 1,
  appRevision: 1,
  configRevision: 2,
  requestId: "request-2",
  result: "SUCCEEDED",
  occurredAt: now.toISOString(),
});
