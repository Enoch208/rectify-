import { createHash } from "node:crypto";
import { z } from "zod";
import {
  actionPayloadSchema,
  actionRecordSchema,
  actionStateSchema,
  type ActionRecord,
} from "./action.ts";
import { providerSchema, timestampSchema } from "./primitives.ts";

export const stableJson = (value: unknown): string => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Action payload numbers must be finite");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`).join(",")}}`;
  }
  throw new Error("Action payload must contain only JSON values");
};

export const payloadHash = (payload: ActionRecord["payload"]): string =>
  createHash("sha256").update(stableJson(payload)).digest("hex");

export const actionRowSchema = z.object({
  id: z.string(),
  case_id: z.string(),
  version: z.number().int(),
  logical_key: z.string(),
  provider: providerSchema,
  kind: z.string(),
  payload_json: z.string(),
  payload_hash: z.string(),
  status: actionStateSchema,
  provider_ids_json: z.string(),
  uncertainty_reason: z.string().nullable(),
  error: z.string().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const attemptRowSchema = z.object({
  number: z.number().int().positive(),
  started_at: timestampSchema,
  finished_at: timestampSchema.nullable(),
  outcome: z.enum(["CONFIRMED", "OUTCOME_UNKNOWN", "CONFIRMED_FAILED"]).nullable(),
  error: z.string().nullable(),
});

export const deserializeAction = (
  rowInput: unknown,
  attemptInputs: readonly unknown[],
): ActionRecord => {
  const row = actionRowSchema.parse(rowInput);
  const payload = actionPayloadSchema.parse(JSON.parse(row.payload_json) as unknown);
  const providerIds = z
    .array(z.string().min(1))
    .parse(JSON.parse(row.provider_ids_json) as unknown);
  const attempts = attemptInputs.map((input) => {
    const attempt = attemptRowSchema.parse(input);
    return {
      number: attempt.number,
      startedAt: attempt.started_at,
      finishedAt: attempt.finished_at,
      outcome: attempt.outcome,
      error: attempt.error,
    };
  });
  return actionRecordSchema.parse({
    id: row.id,
    caseId: row.case_id,
    version: row.version,
    logicalKey: row.logical_key,
    provider: row.provider,
    kind: row.kind,
    payload,
    payloadHash: row.payload_hash,
    status: row.status,
    attempts,
    providerIds,
    uncertaintyReason: row.uncertainty_reason,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
};
