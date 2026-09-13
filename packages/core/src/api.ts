import { z } from "zod";
import { actionRecordSchema } from "./action.ts";
import { approvalRecordSchema } from "./approval.ts";
import { caseRecordSchema } from "./case.ts";
import { evidenceRecordSchema } from "./evidence.ts";
import { outcomeEventRecordSchema } from "./outcome-event.ts";
import { environmentLabelSchema, providerEnvironmentsSchema } from "./primitives.ts";
import { runRecordSchema } from "./run.ts";
import { verificationRecordSchema } from "./verification.ts";

export const caseSummarySchema = caseRecordSchema
  .pick({
    id: true,
    organizationId: true,
    tenantId: true,
    contactId: true,
    contactEmail: true,
    workflow: true,
    state: true,
    engineeringState: true,
    notificationState: true,
    recoveryState: true,
    syncState: true,
    updatedAt: true,
  })
  .extend({
    environment: environmentLabelSchema,
  });

export const getCasesResponseSchema = z.object({
  cases: z.array(caseSummarySchema),
  nextCursor: z.string().min(1).nullable(),
});

export const postCaseRequestSchema = z.object({
  gmailThreadId: z.string().min(1),
});

export const postCaseResponseSchema = z.object({
  case: caseRecordSchema,
});

export const queuedJobResponseSchema = z.object({
  jobId: z.string().min(1),
});

export const getCaseResponseSchema = z.object({
  case: caseRecordSchema,
  environments: providerEnvironmentsSchema,
  evidence: z.array(evidenceRecordSchema),
  verifications: z.array(verificationRecordSchema),
  actions: z.array(actionRecordSchema),
  approvals: z.array(approvalRecordSchema),
  outcomeEvents: z.array(outcomeEventRecordSchema),
});

export const getRunsResponseSchema = z.object({
  runs: z.array(runRecordSchema),
  nextCursor: z.string().min(1).nullable(),
});

export const getRunResponseSchema = z.object({
  run: runRecordSchema,
  actions: z.array(actionRecordSchema),
  evidence: z.array(evidenceRecordSchema),
  verifications: z.array(verificationRecordSchema),
});

export type CaseSummary = z.infer<typeof caseSummarySchema>;
export type GetCasesResponse = z.infer<typeof getCasesResponseSchema>;
export type PostCaseRequest = z.infer<typeof postCaseRequestSchema>;
export type PostCaseResponse = z.infer<typeof postCaseResponseSchema>;
export type QueuedJobResponse = z.infer<typeof queuedJobResponseSchema>;
export type GetCaseResponse = z.infer<typeof getCaseResponseSchema>;
export type GetRunsResponse = z.infer<typeof getRunsResponseSchema>;
export type GetRunResponse = z.infer<typeof getRunResponseSchema>;
