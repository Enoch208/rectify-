import { createHash } from "node:crypto";
import type { ActionRecord, CaseRecord, VerificationRecord } from "@rectify/core";
import type { ActionIntent } from "@rectify/core/ledger";
import { buildCustomerMime } from "@rectify/providers";
import { intakeEntriesForThread } from "@rectify/store";
import { actionKeys, actionKinds } from "./action-keys.ts";
import { allowed, denied, intentFromAction, payloadString } from "./case-flow.ts";
import { customerEmailContent } from "./messages.ts";
import type { WorkerServices } from "./services.ts";
import type { ActionAuthorizer, ActionExecutor } from "./worker.ts";

export interface PreparedDraft {
  draft: ActionRecord;
  send: ActionRecord | null;
}

export const allowedRecipients = (services: WorkerServices, record: CaseRecord): Set<string> =>
  new Set(
    intakeEntriesForThread(services.settings.intakeDirectory, record.sourceThreadId)
      .filter((entry) => entry.tenantId === record.tenantId)
      .map((entry) => entry.contactEmail),
  );

export const verificationIsFresh = (
  services: WorkerServices,
  verification: VerificationRecord,
): boolean => {
  const age = services.now().getTime() - new Date(verification.verifiedAt).getTime();
  return age >= 0 && age < services.settings.approvalTtlMs;
};

const rfc822Id = (services: WorkerServices, logicalKey: string): string => {
  const domain = services.settings.senderAddress.split("@")[1] ?? "rectify.invalid";
  return `rectify-${createHash("sha256").update(logicalKey).digest("hex").slice(0, 32)}@${domain}`;
};

const draftIntent = async (
  services: WorkerServices,
  caseId: string,
  verification: VerificationRecord,
): Promise<ActionIntent> => {
  const draftKey = actionKeys.customerDraft(caseId, verification.id);
  const record = services.store.cases.getCase(caseId);
  const thread = await services.gmail.readThread(record.sourceThreadId);
  const content = customerEmailContent(
    record,
    verification,
    services.settings.customerPortalUrl,
    thread.messages[0]?.subject ?? null,
  );
  const rfc822MessageId = rfc822Id(services, actionKeys.customerSend(caseId, verification.id));
  const approvedMime = buildCustomerMime({
    from: services.settings.senderAddress,
    to: record.contactEmail,
    subject: content.subject,
    body: content.body,
    threadId: record.sourceThreadId,
    inReplyTo: null,
    logicalKey: draftKey,
    rfc822MessageId,
  });
  return {
    caseId,
    logicalKey: draftKey,
    provider: "gmail",
    kind: actionKinds.customerDraft,
    payload: {
      threadId: record.sourceThreadId,
      sender: services.settings.senderAddress,
      recipient: record.contactEmail,
      subject: content.subject,
      body: content.body,
      approvedMime,
      rfc822MessageId,
      verificationId: verification.id,
    },
  };
};

const authorizeDraft =
  (services: WorkerServices, caseId: string, verification: VerificationRecord): ActionAuthorizer =>
  (action) => {
    const current = services.store.cases.getCase(caseId);
    if (verification.result !== "PASS" || verification.caseId !== caseId) {
      return Promise.resolve(denied("A customer draft requires a passing check for this case"));
    }
    if (!verificationIsFresh(services, verification)) {
      return Promise.resolve(denied("The passing check is too old to draft a customer message"));
    }
    const recipient = payloadString(action, "recipient");
    if (
      recipient !== current.contactEmail ||
      !allowedRecipients(services, current).has(recipient)
    ) {
      return Promise.resolve(denied("The draft recipient is not the trusted case contact"));
    }
    return Promise.resolve(allowed);
  };

const createDraft =
  (services: WorkerServices): ActionExecutor =>
  async (action) => {
    const created = await services.gmail.createDraft({
      threadId: payloadString(action, "threadId"),
      rawMime: payloadString(action, "approvedMime"),
    });
    return { providerIds: [created.id, created.message.id] };
  };

export const prepareCustomerDraft = async (
  services: WorkerServices,
  caseId: string,
  verification: VerificationRecord,
): Promise<PreparedDraft> => {
  const draftKey = actionKeys.customerDraft(caseId, verification.id);
  const existing = services.store.ledger.getByLogicalKey(draftKey);
  const draft =
    existing !== null && existing.status !== "PLANNED"
      ? existing
      : await services.actions.execute(
          existing === null
            ? await draftIntent(services, caseId, verification)
            : intentFromAction(existing),
          authorizeDraft(services, caseId, verification),
          createDraft(services),
        );
  const draftId = draft.providerIds[0];
  if (draft.status !== "CONFIRMED" || draftId === undefined) {
    return { draft, send: null };
  }
  const send = services.store.ledger.planAction({
    caseId,
    logicalKey: actionKeys.customerSend(caseId, verification.id),
    provider: "gmail",
    kind: actionKinds.customerSend,
    payload: { ...draft.payload, draftId },
  });
  return { draft, send };
};
