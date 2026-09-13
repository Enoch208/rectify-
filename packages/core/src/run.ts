import { z } from "zod";
import { identifierSchema, providerEnvironmentsSchema, timestampSchema } from "./primitives.ts";

export const runStatusSchema = z.enum(["RUNNING", "SUCCEEDED", "FAILED", "STOPPED"]);

export const runRecordSchema = z.object({
  id: identifierSchema,
  caseId: identifierSchema,
  commit: identifierSchema,
  promptRevision: identifierSchema,
  modelId: identifierSchema,
  configId: identifierSchema,
  releaseId: identifierSchema,
  environments: providerEnvironmentsSchema,
  status: runStatusSchema,
  startedAt: timestampSchema,
  finishedAt: timestampSchema.nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  toolCallCount: z.number().int().nonnegative(),
  stopReason: z.string().min(1).nullable(),
  traceId: identifierSchema.nullable(),
});

export type RunRecord = z.infer<typeof runRecordSchema>;
