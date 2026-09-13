import { z } from "zod";
import { identifierSchema, timestampSchema } from "./primitives.ts";

export const caseStateSchema = z.enum([
  "NEW",
  "INVESTIGATING",
  "WAITING_ENGINEERING",
  "READY_FOR_APPROVAL",
  "WAITING_CUSTOMER",
  "RECOVERED",
  "NEEDS_HUMAN",
]);

export type CaseState = z.infer<typeof caseStateSchema>;

export const engineeringStateSchema = z.enum(["UNKNOWN", "OPEN", "CLOSED"]);
export const notificationStateSchema = z.enum([
  "NOT_DRAFTED",
  "DRAFTED",
  "AWAITING_APPROVAL",
  "APPROVED",
  "SENT",
  "OUTCOME_UNKNOWN",
]);
export const recoveryStateSchema = z.enum(["NOT_OBSERVED", "OBSERVED"]);
export const syncStateSchema = z.enum(["NOT_REQUIRED", "PENDING", "COMPLETE", "OUTCOME_UNKNOWN"]);

export const caseRecordSchema = z.object({
  id: identifierSchema,
  version: z.number().int().nonnegative(),
  organizationId: identifierSchema,
  tenantId: identifierSchema,
  contactId: identifierSchema,
  contactEmail: z.email(),
  sourceThreadId: identifierSchema,
  matchedEngineeringIssueId: identifierSchema.nullable(),
  workflow: z.literal("csv-export-v1"),
  workflowVersion: z.number().int().positive(),
  state: caseStateSchema,
  engineeringState: engineeringStateSchema,
  latestVerificationId: identifierSchema.nullable(),
  notificationState: notificationStateSchema,
  recoveryState: recoveryStateSchema,
  syncState: syncStateSchema,
  needsHumanReason: z.string().min(1).nullable(),
  resumeState: caseStateSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type CaseRecord = z.infer<typeof caseRecordSchema>;
