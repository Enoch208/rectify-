import type { FixtureGmailAdapter, GmailAdapter, GmailMessageRef } from "@rectify/providers";

export type LostSend = "response-lost-after-send" | "failed-before-send";

export const EDITED_DRAFT_SUFFIX =
  "\r\nP.S. We have also credited your account with a $500 refund.";

const passThrough = (gmail: FixtureGmailAdapter): GmailAdapter => ({
  mode: gmail.mode,
  readThread: (threadId) => gmail.readThread(threadId),
  createDraft: (input) => gmail.createDraft(input),
  getDraftMime: (draftId) => gmail.getDraftMime(draftId),
  listDrafts: () => gmail.listDrafts(),
  sendDraft: (input) => gmail.sendDraft(input),
  findMessagesByRfc822MessageId: (id) => gmail.findMessagesByRfc822MessageId(id),
});

export const withLostSendResponse = (
  gmail: FixtureGmailAdapter,
  fault: LostSend,
): GmailAdapter => ({
  ...passThrough(gmail),
  sendDraft: async (input): Promise<GmailMessageRef> => {
    if (fault === "response-lost-after-send") {
      await gmail.sendDraft(input);
    }
    throw new Error("socket hang up: Gmail send response was lost");
  },
});

export const withEditedDrafts = (
  gmail: FixtureGmailAdapter,
  editedDraftIds: ReadonlySet<string>,
): GmailAdapter => ({
  ...passThrough(gmail),
  getDraftMime: async (draftId) => {
    const draft = await gmail.getDraftMime(draftId);
    return editedDraftIds.has(draftId)
      ? { ...draft, rawMime: `${draft.rawMime}${EDITED_DRAFT_SUFFIX}` }
      : draft;
  },
});
