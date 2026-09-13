import { createHmac } from "node:crypto";
import type { ApprovalRecord } from "@rectify/core";
import {
  bindSlackDecision,
  parseSlackDecision,
  StatusError,
  verifySlackRequest,
} from "@rectify/store";
import { actionKinds } from "@rectify/worker";
import type { EvaluationArtifact } from "../schema.ts";
import { harnessIdentity, type ScenarioEnvironment } from "./environment.ts";

export type ApprovalCallback = EvaluationArtifact["approvalCallbacks"][number];
type RejectionKind = NonNullable<ApprovalCallback["rejectionKind"]>;

export interface CallbackRequest {
  approvalId: string;
  decision: "APPROVED" | "REJECTED";
  slackUserId: string;
}

interface SignedCallback {
  rawBody: string;
  signature: string;
  timestamp: string;
}

const buttonFor = (env: ScenarioEnvironment, approvalId: string) => {
  const approval = env.store.approvals.get(approvalId);
  const request = env.store.cases
    .getCaseResponse(approval.caseId)
    .actions.find(
      (action) =>
        action.kind === actionKinds.approvalRequest &&
        action.status === "CONFIRMED" &&
        action.payload.approvalId === approvalId,
    );
  const nonce = request?.payload.nonce;
  const ts = request?.providerIds[0];
  if (typeof nonce !== "string" || ts === undefined) {
    throw new Error(`No confirmed Slack approval request carries approval ${approvalId}`);
  }
  return { nonce, ts };
};

const signCallback = (
  env: ScenarioEnvironment,
  request: CallbackRequest,
  now: Date,
): SignedCallback => {
  const button = buttonFor(env, request.approvalId);
  const payload = {
    type: "block_actions",
    team: { id: harnessIdentity.slackWorkspaceId },
    user: { id: request.slackUserId },
    channel: { id: env.slack.channelId },
    message: { ts: button.ts },
    actions: [
      {
        action_id: "rectify_approval",
        value: JSON.stringify({
          approvalId: request.approvalId,
          nonce: button.nonce,
          decision: request.decision,
        }),
      },
    ],
  };
  const rawBody = new URLSearchParams({ payload: JSON.stringify(payload) }).toString();
  const timestamp = String(Math.floor(now.getTime() / 1_000));
  const digest = createHmac("sha256", env.secrets.slackSigning)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest("hex");
  return { rawBody, signature: `v0=${digest}`, timestamp };
};

const rejectionFor = (
  approval: ApprovalRecord,
  slackUserId: string,
  approverIds: ReadonlySet<string>,
  now: Date,
): RejectionKind | null => {
  if (!approverIds.has(slackUserId)) {
    return "UNAUTHORIZED";
  }
  if (approval.revokedAt !== null || new Date(approval.expiresAt).getTime() <= now.getTime()) {
    return "STALE";
  }
  if (approval.consumedAt !== null || approval.decision !== "PENDING") {
    return "DUPLICATE";
  }
  return null;
};

export const deliverApprovalCallback = (
  env: ScenarioEnvironment,
  request: CallbackRequest,
): ApprovalCallback => {
  const now = new Date();
  const approverIds = new Set([harnessIdentity.approverId]);
  const signed = signCallback(env, request, now);
  verifySlackRequest(
    signed.rawBody,
    signed.signature,
    signed.timestamp,
    env.secrets.slackSigning,
    now,
  );
  const { payload, decision } = parseSlackDecision(signed.rawBody);
  const approval = env.store.approvals.get(decision.approvalId);
  const action = env.store.ledger.getAction(approval.actionId);
  const outcome = (accepted: boolean, rejectionKind: RejectionKind | null): ApprovalCallback => ({
    approvalId: approval.id,
    payloadHash: approval.businessFieldsHash,
    accepted,
    rejectionKind,
  });
  let bound: ApprovalRecord;
  try {
    bound = bindSlackDecision(payload, decision, approval, approverIds, now);
  } catch (error: unknown) {
    const kind = rejectionFor(approval, payload.user.id, approverIds, now);
    if (!(error instanceof StatusError) || kind === null) {
      throw error;
    }
    return outcome(false, kind);
  }
  if (bound.actionHash !== action.payloadHash || bound.businessFieldsHash !== action.payloadHash) {
    return outcome(false, "EDITED");
  }
  env.store.approvals.save(bound);
  return outcome(true, null);
};
