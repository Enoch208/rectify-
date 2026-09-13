import { caseRecordSchema, type CaseRecord } from "@rectify/core";
import type { IntakeEntry } from "./config.ts";

export const createCaseRecord = (
  identity: IntakeEntry,
  id: string,
  timestamp: string,
): CaseRecord =>
  caseRecordSchema.parse({
    id,
    version: 0,
    organizationId: identity.organizationId,
    tenantId: identity.tenantId,
    contactId: identity.contactId,
    contactEmail: identity.contactEmail,
    sourceThreadId: identity.gmailThreadId,
    matchedEngineeringIssueId: null,
    workflow: "csv-export-v1",
    workflowVersion: 1,
    state: "NEW",
    engineeringState: "UNKNOWN",
    latestVerificationId: null,
    notificationState: "NOT_DRAFTED",
    recoveryState: "NOT_OBSERVED",
    syncState: "NOT_REQUIRED",
    needsHumanReason: null,
    resumeState: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
