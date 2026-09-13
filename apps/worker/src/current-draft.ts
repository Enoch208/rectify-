import type { ApprovalRecord } from "@rectify/core";
import type { CurrentDraft } from "@rectify/core/policy";
import { payloadHash } from "@rectify/core/ledger";
import { parseMimeBody, parseMimeHeaders, type GmailDraftMime } from "@rectify/providers";

const addressOf = (value: string | undefined): string => {
  const trimmed = (value ?? "").trim();
  const bracketed = /<([^>]+)>/u.exec(trimmed);
  return (bracketed?.[1] ?? trimmed).toLowerCase();
};

const normalizeText = (value: string): string =>
  value
    .replace(/\r\n/gu, "\n")
    .replace(/[ \t]+$/gmu, "")
    .trim();

export const currentDraftFor = (
  approval: ApprovalRecord,
  draft: GmailDraftMime,
  providerAccountId: string,
  approvedPayload: Record<string, unknown>,
): CurrentDraft => {
  const headers = parseMimeHeaders(draft.rawMime);
  const approvedRecipient = approval.recipients[0] ?? "";
  const sender =
    addressOf(headers.from) === approval.sender.toLowerCase()
      ? approval.sender
      : addressOf(headers.from);
  const recipient =
    addressOf(headers.to) === approvedRecipient.toLowerCase()
      ? approvedRecipient
      : addressOf(headers.to);
  const subject =
    (headers.subject ?? "").trim() === approval.subject
      ? approval.subject
      : (headers.subject ?? "");
  const draftBody = parseMimeBody(draft.rawMime);
  const body =
    normalizeText(draftBody) === normalizeText(approval.body) ? approval.body : draftBody;
  const unchanged =
    sender === approval.sender &&
    recipient === approvedRecipient &&
    subject === approval.subject &&
    body === approval.body;
  return {
    providerAccountId,
    draftId: draft.draftId,
    threadId: draft.threadId,
    sender,
    recipients: [recipient],
    subject,
    body,
    approvedMime: unchanged ? approval.approvedMime : draft.rawMime,
    businessFieldsHash: unchanged
      ? approval.businessFieldsHash
      : payloadHash({
          ...Object.fromEntries(
            Object.entries(approvedPayload).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          ),
          sender,
          recipient,
          subject,
          body,
        }),
  };
};
