import { createHmac, timingSafeEqual } from "node:crypto";
import { outcomeEventRecordSchema, type OutcomeEventRecord } from "@rectify/core";

type UnsignedOutcomeEvent = Omit<OutcomeEventRecord, "signature">;

const canonicalize = (event: UnsignedOutcomeEvent): string =>
  JSON.stringify([
    event.eventId,
    event.caseId,
    event.tenantId,
    event.actorType,
    event.actorId,
    event.workflow,
    event.manifestRevision,
    event.appRevision,
    event.configRevision,
    event.requestId,
    event.result,
    event.occurredAt,
  ]);

export const signOutcomeEvent = (event: UnsignedOutcomeEvent, secret: string): OutcomeEventRecord =>
  outcomeEventRecordSchema.parse({
    ...event,
    signature: createHmac("sha256", secret).update(canonicalize(event)).digest("hex"),
  });

export const verifyOutcomeEvent = (event: OutcomeEventRecord, secret: string): boolean => {
  const { signature, ...unsigned } = event;
  const expected = createHmac("sha256", secret).update(canonicalize(unsigned)).digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
};
