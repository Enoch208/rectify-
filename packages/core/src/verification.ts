import { z } from "zod";
import { identifierSchema, sha256Schema, timestampSchema } from "./primitives.ts";

export const csvExportContractVersionSchema = z.literal("csv-export-v1");
export const verificationResultSchema = z.enum(["PASS", "FAIL", "INCONCLUSIVE"]);

export const csvExportRowSchema = z.object({
  recordId: identifierSchema,
  tenantId: identifierSchema,
  period: z.string().min(1),
  amount: z.string().regex(/^-?\d+(?:\.\d+)?$/u),
  status: z.string().min(1),
});

export const csvExportInputSchema = z.object({
  tenantId: identifierSchema,
  period: z.string().min(1),
  manifestRevision: z.number().int().positive(),
  appRevision: z.number().int().positive(),
  configRevision: z.number().int().positive(),
  probeCredentialId: identifierSchema,
});

export const csvExportExpectationSchema = z.object({
  schema: z.tuple([
    z.literal("record_id"),
    z.literal("tenant_id"),
    z.literal("period"),
    z.literal("amount"),
    z.literal("status"),
  ]),
  rows: z.array(csvExportRowSchema),
});

export const csvExportObservationSchema = z.object({
  httpStatus: z.number().int().min(100).max(599).nullable(),
  schema: z.array(z.string()),
  rows: z.array(csvExportRowSchema),
  failureReason: z.string().min(1).nullable(),
});

export const verificationRecordSchema = z.object({
  id: identifierSchema,
  caseId: identifierSchema,
  contractVersion: csvExportContractVersionSchema,
  input: csvExportInputSchema,
  requestId: identifierSchema,
  expected: csvExportExpectationSchema,
  observed: csvExportObservationSchema,
  responseHash: sha256Schema.nullable(),
  normalizedContentHash: sha256Schema.nullable(),
  result: verificationResultSchema,
  verifiedAt: timestampSchema,
});

export type CsvExportInput = z.infer<typeof csvExportInputSchema>;
export type CsvExportExpectation = z.infer<typeof csvExportExpectationSchema>;
export type VerificationRecord = z.infer<typeof verificationRecordSchema>;
