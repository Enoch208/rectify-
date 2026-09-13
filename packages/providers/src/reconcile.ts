import type { GitHubAdapter, GmailAdapter, GmailDraftMime, SlackAdapter } from "./contracts.ts";
import { parseMimeHeaders } from "./mime.ts";

export type ReconciliationOutcome =
  | { outcome: "CONFIRMED"; providerIds: readonly string[] }
  | { outcome: "UNRESOLVED"; reason: string };

export const rectifyMarker = (logicalKey: string): string => `rectify-action:${logicalKey}`;

const exactlyOne = <Item>(
  matches: readonly Item[],
  reasons: { none: string; many: string },
  providerIds: (match: Item) => readonly string[],
): ReconciliationOutcome => {
  const [first] = matches;
  if (first === undefined) {
    return { outcome: "UNRESOLVED", reason: reasons.none };
  }
  if (matches.length > 1) {
    return { outcome: "UNRESOLVED", reason: reasons.many };
  }
  return { outcome: "CONFIRMED", providerIds: providerIds(first) };
};

export const reconcileGitHubIssue = async (
  github: GitHubAdapter,
  logicalKey: string,
): Promise<ReconciliationOutcome> => {
  const marker = rectifyMarker(logicalKey);
  const issues = await github.listIssues();
  return exactlyOne(
    issues.filter((issue) => issue.body?.includes(marker) === true),
    {
      none: "No issue carries the action marker",
      many: "Multiple issues carry the action marker",
    },
    (issue) => [String(issue.number), issue.html_url],
  );
};

export const reconcileGitHubComment = async (
  github: GitHubAdapter,
  issueNumber: number,
  logicalKey: string,
): Promise<ReconciliationOutcome> => {
  const marker = rectifyMarker(logicalKey);
  const comments = await github.listComments(issueNumber);
  return exactlyOne(
    comments.filter((comment) => comment.body.includes(marker)),
    {
      none: "No comment carries the action marker",
      many: "Multiple comments carry the action marker",
    },
    (comment) => [String(comment.id), comment.html_url],
  );
};

export const reconcileSlackMessage = async (
  slack: SlackAdapter,
  logicalKey: string,
  threadTs: string | null,
): Promise<ReconciliationOutcome> => {
  const marker = rectifyMarker(logicalKey);
  const messages =
    threadTs === null ? await slack.readMessages(100) : await slack.readReplies(threadTs, 100);
  return exactlyOne(
    messages.filter((message) => message.text.includes(marker)),
    {
      none: "No Slack message carries the action marker",
      many: "Multiple Slack messages carry the action marker",
    },
    (message) => [message.ts],
  );
};

export const reconcileGmailDraft = async (
  gmail: GmailAdapter,
  logicalKey: string,
): Promise<ReconciliationOutcome> => {
  const mimes: GmailDraftMime[] = [];
  for (const draft of await gmail.listDrafts()) {
    mimes.push(await gmail.getDraftMime(draft.draftId));
  }
  return exactlyOne(
    mimes.filter((draft) => parseMimeHeaders(draft.rawMime)["x-rectify-action"] === logicalKey),
    {
      none: "No draft carries the action header",
      many: "Multiple drafts carry the action header",
    },
    (draft) => [draft.draftId, draft.messageId],
  );
};

export const reconcileGmailSend = async (
  gmail: GmailAdapter,
  rfc822MessageId: string,
): Promise<ReconciliationOutcome> => {
  const messages = await gmail.findMessagesByRfc822MessageId(rfc822MessageId);
  return exactlyOne(
    messages,
    {
      none: "No sent message found; absence is not proof the send did not happen",
      many: "Multiple messages carry the Message-ID",
    },
    (message) => [message.id],
  );
};
