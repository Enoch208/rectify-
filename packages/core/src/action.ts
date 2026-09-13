import { z } from "zod";
import { identifierSchema, providerSchema, sha256Schema, timestampSchema } from "./primitives.ts";

export const actionStateSchema = z.enum([
  "PLANNED",
  "AUTHORIZED",
  "DISPATCHING",
  "CONFIRMED",
  "OUTCOME_UNKNOWN",
  "REJECTED",
  "CONFIRMED_FAILED",
]);

export type ActionState = z.infer<typeof actionStateSchema>;

export const actionAttemptSchema = z.object({
  number: z.number().int().positive(),
  startedAt: timestampSchema,
  finishedAt: timestampSchema.nullable(),
  outcome: z.enum(["CONFIRMED", "OUTCOME_UNKNOWN", "CONFIRMED_FAILED"]).nullable(),
  error: z.string().min(1).nullable(),
});

export const actionRecordSchema = z.object({
  id: identifierSchema,
  caseId: identifierSchema,
  version: z.number().int().positive(),
  logicalKey: identifierSchema,
  provider: providerSchema,
  kind: identifierSchema,
  payload: z.record(z.string(), z.unknown()),
  payloadHash: sha256Schema,
  status: actionStateSchema,
  attempts: z.array(actionAttemptSchema),
  providerIds: z.array(identifierSchema),
  uncertaintyReason: z.string().min(1).nullable(),
  error: z.string().min(1).nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type ActionRecord = z.infer<typeof actionRecordSchema>;
