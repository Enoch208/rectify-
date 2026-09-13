import { z } from "zod";
import { identifierSchema, timestampSchema } from "./primitives.ts";

export const outcomeResultSchema = z.enum(["SUCCEEDED", "FAILED"]);

export const outcomeEventRecordSchema = z.object({
  eventId: identifierSchema,
  caseId: identifierSchema,
  tenantId: identifierSchema,
  actorType: z.enum(["CUSTOMER", "PROBE"]),
  actorId: identifierSchema,
  workflow: z.literal("csv-export-v1"),
  manifestRevision: z.number().int().positive(),
  appRevision: z.number().int().positive(),
  configRevision: z.number().int().positive(),
  requestId: identifierSchema,
  result: outcomeResultSchema,
  occurredAt: timestampSchema,
  signature: z.string().min(1),
});

export type OutcomeEventRecord = z.infer<typeof outcomeEventRecordSchema>;
