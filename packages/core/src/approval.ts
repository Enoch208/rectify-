import { z } from "zod";
import { identifierSchema, sha256Schema, timestampSchema } from "./primitives.ts";

export const approvalDecisionSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "REVOKED"]);

export const approvalRecordSchema = z.object({
  id: identifierSchema,
  caseId: identifierSchema,
  caseVersion: z.number().int().nonnegative(),
  actionId: identifierSchema,
  actionVersion: z.number().int().positive(),
  actionHash: sha256Schema,
  providerAccountId: identifierSchema,
  draftId: identifierSchema,
  threadId: identifierSchema,
  sender: z.email(),
  recipients: z.array(z.email()).min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  approvedMime: z.string().min(1),
  businessFieldsHash: sha256Schema,
  verificationId: identifierSchema,
  appRevision: z.number().int().positive(),
  configRevision: z.number().int().positive(),
  policyVersion: identifierSchema,
  approverId: identifierSchema.nullable(),
  slackWorkspaceId: identifierSchema,
  slackChannelId: identifierSchema,
  slackMessageId: identifierSchema,
  nonce: identifierSchema,
  decision: approvalDecisionSchema,
  expiresAt: timestampSchema,
  consumedAt: timestampSchema.nullable(),
  revokedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
});

export type ApprovalRecord = z.infer<typeof approvalRecordSchema>;
