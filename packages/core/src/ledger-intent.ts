import { z } from "zod";
import { actionPayloadSchema, type ActionRecord } from "./action.ts";
import { providerSchema, type Provider } from "./primitives.ts";

export const actionIntentSchema = z.object({
  caseId: z.string().min(1),
  logicalKey: z.string().min(1),
  provider: providerSchema,
  kind: z.string().min(1),
  payload: actionPayloadSchema,
});

export interface ActionIntent {
  caseId: string;
  logicalKey: string;
  provider: Provider;
  kind: string;
  payload: ActionRecord["payload"];
}

export interface ActionLedgerOptions {
  path: string;
  now?: () => Date;
  createId?: () => string;
}
