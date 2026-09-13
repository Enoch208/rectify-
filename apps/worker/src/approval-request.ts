import { randomBytes } from "node:crypto";
import {
  approvalRecordSchema,
  type ActionRecord,
  type ApprovalRecord,
  type VerificationRecord,
} from "@rectify/core";
import { actionKeys, actionKinds } from "./action-keys.ts";
import { allowed, denied, executeOnce, moveCase, payloadString } from "./case-flow.ts";
import { prepareCustomerDraft, verificationIsFresh } from "./customer-draft.ts";
import { approvalBlocks, approvalRequestText } from "./messages.ts";
import type { WorkerServices } from "./services.ts";

export const CUSTOMER_SEND_POLICY_VERSION = "customer-send-policy-v1";

export type ApprovalPreparation =
  { ready: true; approval: ApprovalRecord } | { ready: false; reason: string };

const requestFor = async (
  services: WorkerServices,
  caseId: string,
  verification: VerificationRecord,
  send: ActionRecord,
): Promise<ActionRecord> => {
  const key = actionKeys.approvalRequest(caseId, verification.id);
  return executeOnce(
    services,
    () => {
      const approvalId = services.createId();
      const nonce = randomBytes(18).toString("base64url");
      const text = approvalRequestText(
        payloadString(send, "recipient"),
        payloadString(send, "subject"),
        payloadString(send, "body"),
        verification,
        key,
      );
      return {
        caseId,
        logicalKey: key,
        provider: "slack",
        kind: actionKinds.approvalRequest,
        payload: {
          approvalId,
          nonce,
          text,
          sendActionId: send.id,
          verificationId: verification.id,
        },
      };
    },
    () =>
      Promise.resolve(
        send.status === "PLANNED" && verificationIsFresh(services, verification)
          ? allowed
          : denied("Approval can only be requested for a planned send with a fresh passing check"),
      ),
    async (action) => {
      const message = await services.slack.postMessage({
        text: payloadString(action, "text"),
        blocks: approvalBlocks(
          payloadString(action, "text"),
          payloadString(action, "approvalId"),
          payloadString(action, "nonce"),
        ),
      });
      return { providerIds: [message.ts] };
    },
    key,
  );
};

const saveApproval = (
  services: WorkerServices,
  caseId: string,
  verification: VerificationRecord,
  send: ActionRecord,
  request: ActionRecord,
): ApprovalRecord => {
  const approvalId = payloadString(request, "approvalId");
  const slackMessageId = request.providerIds[0];
  if (slackMessageId === undefined) {
    throw new Error("Confirmed approval request has no Slack message timestamp");
  }
  const record = moveCase(services, caseId, {
    state: "READY_FOR_APPROVAL",
    notificationState: "AWAITING_APPROVAL",
    needsHumanReason: null,
    resumeState: null,
  });
  const now = services.now();
  const expiresAt = Math.min(
    now.getTime() + services.settings.approvalTtlMs,
    new Date(verification.verifiedAt).getTime() + services.settings.approvalTtlMs,
  );
  const approval = approvalRecordSchema.parse({
    id: approvalId,
    caseId,
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    caseVersion: record.version,
    actionId: send.id,
    actionVersion: send.version,
    actionHash: send.payloadHash,
    providerAccountId: services.settings.providerAccountId,
    draftId: payloadString(send, "draftId"),
    threadId: payloadString(send, "threadId"),
    sender: payloadString(send, "sender"),
    recipients: [payloadString(send, "recipient")],
    subject: payloadString(send, "subject"),
    body: payloadString(send, "body"),
    approvedMime: payloadString(send, "approvedMime"),
    businessFieldsHash: send.payloadHash,
    verificationId: verification.id,
    appRevision: verification.input.appRevision,
    configRevision: verification.input.configRevision,
    policyVersion: CUSTOMER_SEND_POLICY_VERSION,
    approverId: null,
    slackWorkspaceId: services.settings.slackWorkspaceId,
    slackChannelId: services.slack.channelId,
    slackMessageId,
    nonce: payloadString(request, "nonce"),
    decision: "PENDING",
    expiresAt: new Date(expiresAt).toISOString(),
    consumedAt: null,
    revokedAt: null,
    createdAt: now.toISOString(),
  });
  services.store.approvals.save(approval);
  return approval;
};

export const prepareCustomerApproval = async (
  services: WorkerServices,
  caseId: string,
  verification: VerificationRecord,
): Promise<ApprovalPreparation> => {
  const { draft, send } = await prepareCustomerDraft(services, caseId, verification);
  if (send === null) {
    return {
      ready: false,
      reason: `Customer draft is ${draft.status}: ${draft.error ?? draft.uncertaintyReason ?? "not confirmed"}`,
    };
  }
  const request = await requestFor(services, caseId, verification, send);
  if (request.status !== "CONFIRMED") {
    return {
      ready: false,
      reason: `Slack approval request is ${request.status}: ${request.error ?? request.uncertaintyReason ?? "not confirmed"}`,
    };
  }
  const existing = services.store.approvals
    .listForCase(caseId)
    .find((approval) => approval.id === payloadString(request, "approvalId"));
  return {
    ready: true,
    approval: existing ?? saveApproval(services, caseId, verification, send, request),
  };
};
