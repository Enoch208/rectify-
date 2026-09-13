import { z } from "zod";
import {
  environmentLabelSchema,
  identifierSchema,
  providerSchema,
  sha256Schema,
  timestampSchema,
} from "./primitives.ts";

export const evidenceFactKindSchema = z.enum(["REPORTED", "OBSERVED"]);

export const evidenceRecordSchema = z.object({
  id: identifierSchema,
  caseId: identifierSchema,
  provider: providerSchema,
  sourceId: identifierSchema,
  sourceUrl: z.url().nullable(),
  retrievedAt: timestampSchema,
  factKind: evidenceFactKindSchema,
  fact: z.string().min(1),
  redactedContent: z.string().min(1).nullable(),
  contentHash: sha256Schema,
  environment: environmentLabelSchema,
});

export type EvidenceRecord = z.infer<typeof evidenceRecordSchema>;
