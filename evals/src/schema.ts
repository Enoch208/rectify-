import {
  actionRecordSchema,
  approvalRecordSchema,
  caseRecordSchema,
  evidenceRecordSchema,
  outcomeEventRecordSchema,
  providerEnvironmentsSchema,
  timestampSchema,
  verificationRecordSchema,
} from "@rectify/core";
import { z } from "zod";

export const scenarioIdSchema = z.enum(["E01", "E02", "E03", "E04", "E05", "E06"]);

export const providerEffectSchema = z.object({
  provider: z.enum(["gmail", "github", "slack"]),
  kind: z.string().min(1),
  logicalKey: z.string().min(1),
  externalId: z.string().min(1),
  caseId: z.string().min(1),
  tenantId: z.string().min(1),
  occurredAt: timestampSchema,
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/u),
  recipient: z.email().nullable(),
  approvalId: z.string().min(1).nullable(),
});

export const evaluationArtifactSchema = z.object({
  schemaVersion: z.literal(1),
  scenarioId: scenarioIdSchema,
  trial: z.number().int().min(1).max(3),
  capturedAt: timestampSchema,
  environments: providerEnvironmentsSchema,
  case: caseRecordSchema,
  evidence: z.array(evidenceRecordSchema),
  verifications: z.array(verificationRecordSchema),
  actions: z.array(actionRecordSchema),
  approvals: z.array(approvalRecordSchema),
  outcomeEvents: z.array(outcomeEventRecordSchema),
  providerEffects: z.array(providerEffectSchema),
  tenantAccesses: z.array(
    z.object({ provider: z.string().min(1), tenantId: z.string().min(1), authorized: z.boolean() }),
  ),
  forbiddenEffects: z.array(z.string().min(1)),
  configAudits: z.array(
    z.object({
      kind: z.literal("HUMAN_APPLIED_DEMO_CONFIGURATION_FIX"),
      tenantId: z.string().min(1),
      occurredAt: timestampSchema,
      toRevision: z.number().int().positive(),
    }),
  ),
  clarifications: z.array(
    z.object({
      authority: z.literal("OPERATOR"),
      tenantId: z.string().min(1),
      resolvedAt: timestampSchema,
    }),
  ),
  sourceChallenges: z.array(z.enum(["DISTRACTOR", "AMBIGUOUS_IDENTITY", "PROMPT_INJECTION"])),
  approvalCallbacks: z.array(
    z.object({
      approvalId: z.string().min(1),
      payloadHash: z.string().regex(/^[a-f0-9]{64}$/u),
      accepted: z.boolean(),
      rejectionKind: z.enum(["STALE", "EDITED", "DUPLICATE", "UNAUTHORIZED"]).nullable(),
    }),
  ),
  reconciliations: z.array(
    z.object({
      branch: z.enum(["RECONCILABLE", "UNRESOLVABLE"]),
      result: z.enum(["CONFIRMED_ORIGINAL", "HELD_UNKNOWN", "RESENT"]),
    }),
  ),
});

export const checkResultSchema = z.object({
  id: z.string().min(1),
  passed: z.boolean(),
  detail: z.string().min(1),
});

export const verdictSchema = z.object({
  scenarioId: scenarioIdSchema,
  trial: z.number().int().min(1).max(3),
  passed: z.boolean(),
  checkedAt: timestampSchema,
  artifactHash: z.string().regex(/^[a-f0-9]{64}$/u),
  checks: z.array(checkResultSchema).min(1),
});

export type EvaluationArtifact = z.infer<typeof evaluationArtifactSchema>;
export type CheckResult = z.infer<typeof checkResultSchema>;
export type Verdict = z.infer<typeof verdictSchema>;
