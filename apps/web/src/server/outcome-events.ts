import { outcomeEventRecordSchema, type OutcomeEventRecord } from "@rectify/core";
import { verifyOutcomeEvent } from "@rectify/core/outcomes";
import type { Store } from "@rectify/store";
import { HttpError } from "./errors.ts";

export const acceptCustomerOutcome = (
  input: unknown,
  secret: string,
  store: Pick<Store, "cases" | "outcomes">,
  now: Date,
): OutcomeEventRecord => {
  const parsed = outcomeEventRecordSchema.safeParse(input);
  if (!parsed.success) {
    throw new HttpError(400, "Product outcome did not match the signed event contract");
  }
  const event = parsed.data;
  if (!verifyOutcomeEvent(event, secret)) {
    throw new HttpError(401, "Product outcome signature is invalid");
  }
  if (event.actorType !== "CUSTOMER") {
    throw new HttpError(403, "Probe outcomes cannot establish customer recovery");
  }
  const occurredAt = new Date(event.occurredAt).getTime();
  if (occurredAt > now.getTime() + 30_000 || now.getTime() - occurredAt > 300_000) {
    throw new HttpError(409, "Product outcome event is stale");
  }
  const data = store.cases.getCaseResponse(event.caseId);
  if (data.case.tenantId !== event.tenantId) {
    throw new HttpError(403, "Product outcome tenant does not match the case");
  }
  if (data.case.state !== "WAITING_CUSTOMER") {
    throw new HttpError(409, `Customer outcome is not allowed while case is ${data.case.state}`);
  }
  const verification = data.verifications.find(
    (record) => record.id === data.case.latestVerificationId,
  );
  if (verification?.result !== "PASS") {
    throw new HttpError(409, "Customer outcome requires the latest passing verification");
  }
  const inputRevision = verification.input;
  if (
    event.manifestRevision !== inputRevision.manifestRevision ||
    event.appRevision !== inputRevision.appRevision ||
    event.configRevision !== inputRevision.configRevision
  ) {
    throw new HttpError(409, "Product outcome revisions do not match the passing verification");
  }
  if (occurredAt < new Date(verification.verifiedAt).getTime()) {
    throw new HttpError(409, "Product outcome predates the passing verification");
  }
  store.outcomes.saveCustomerOutcome(event);
  return event;
};
