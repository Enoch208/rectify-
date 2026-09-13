import { createHmac, timingSafeEqual } from "node:crypto";
import { approvalRecordSchema, type ApprovalRecord } from "@rectify/core";
import { z } from "zod";
import { HttpError } from "./errors.ts";

const slackPayloadSchema = z.object({
  type: z.literal("block_actions"),
  team: z.object({ id: z.string().min(1) }),
  user: z.object({ id: z.string().min(1) }),
  channel: z.object({ id: z.string().min(1) }),
  message: z.object({ ts: z.string().min(1) }),
  actions: z
    .array(
      z.object({
        action_id: z.literal("rectify_approval"),
        value: z.string().min(1),
      }),
    )
    .length(1),
});

const decisionSchema = z.object({
  approvalId: z.string().min(1),
  nonce: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
});

export type SlackPayload = z.infer<typeof slackPayloadSchema>;
export type SlackDecision = z.infer<typeof decisionSchema>;

const safeEqual = (received: string, expected: string): boolean => {
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return (
    receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes)
  );
};

export const verifySlackRequest = (
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  signingSecret: string,
  now: Date,
): void => {
  if (signature === null || timestamp === null || !/^\d+$/u.test(timestamp)) {
    throw new HttpError(401, "Slack signature headers are required");
  }
  const signedAt = Number(timestamp) * 1_000;
  if (!Number.isSafeInteger(signedAt) || Math.abs(now.getTime() - signedAt) > 300_000) {
    throw new HttpError(401, "Slack request timestamp is stale");
  }
  const expected = `v0=${createHmac("sha256", signingSecret)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest("hex")}`;
  if (!safeEqual(signature, expected)) {
    throw new HttpError(401, "Slack signature is invalid");
  }
};

export const parseSlackDecision = (
  rawBody: string,
): { payload: SlackPayload; decision: SlackDecision } => {
  const encoded = new URLSearchParams(rawBody).get("payload");
  if (encoded === null) {
    throw new HttpError(400, "Slack interaction payload is missing");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(encoded);
  } catch {
    throw new HttpError(400, "Slack interaction payload is invalid");
  }
  const payloadResult = slackPayloadSchema.safeParse(decoded);
  if (!payloadResult.success) {
    throw new HttpError(400, "Slack interaction payload did not match the contract");
  }
  const payload = payloadResult.data;
  let value: unknown;
  try {
    value = JSON.parse(payload.actions[0]?.value ?? "null");
  } catch {
    throw new HttpError(400, "Slack approval value is invalid");
  }
  const decision = decisionSchema.safeParse(value);
  if (!decision.success) {
    throw new HttpError(400, "Slack approval value did not match the contract");
  }
  return { payload, decision: decision.data };
};

export const bindSlackDecision = (
  payload: SlackPayload,
  decision: SlackDecision,
  approval: ApprovalRecord,
  approverIds: ReadonlySet<string>,
  now: Date,
): ApprovalRecord => {
  if (!approverIds.has(payload.user.id)) throw new HttpError(403, "Slack user is not an approver");
  if (approval.decision !== "PENDING") throw new HttpError(409, "Approval is no longer pending");
  if (approval.consumedAt !== null || approval.revokedAt !== null)
    throw new HttpError(409, "Approval is no longer usable");
  if (new Date(approval.expiresAt).getTime() <= now.getTime())
    throw new HttpError(409, "Approval has expired");
  if (approval.slackWorkspaceId !== payload.team.id)
    throw new HttpError(403, "Slack workspace does not match approval");
  if (approval.slackChannelId !== payload.channel.id)
    throw new HttpError(403, "Slack channel does not match approval");
  if (approval.slackMessageId !== payload.message.ts)
    throw new HttpError(403, "Slack message does not match approval");
  if (approval.nonce !== decision.nonce) throw new HttpError(403, "Approval nonce does not match");
  return approvalRecordSchema.parse({
    ...approval,
    approverId: payload.user.id,
    decision: decision.decision,
  });
};
