import { z } from "zod";

export const providerModeSchema = z.enum(["live", "arga", "local_fixture"]);
export type ProviderMode = z.infer<typeof providerModeSchema>;

export const providerEnvironmentByMode = {
  live: "LIVE PROVIDER",
  arga: "ARGA TWIN",
  local_fixture: "LOCAL FIXTURE",
} as const satisfies Record<ProviderMode, string>;

export const gmailMessageSchema = z.object({
  id: z.string().min(1),
  threadId: z.string().min(1),
  labelIds: z.array(z.string()).optional(),
  snippet: z.string().optional(),
  from: z.string().nullable(),
  to: z.string().nullable(),
  subject: z.string().nullable(),
  date: z.string().nullable(),
  bodyText: z.string().nullable(),
});

export const gmailThreadSchema = z.object({
  id: z.string().min(1),
  historyId: z.string().min(1).optional(),
  messages: z.array(gmailMessageSchema),
});

export const gmailDraftSchema = z.object({
  id: z.string().min(1),
  message: z.object({
    id: z.string().min(1),
    threadId: z.string().min(1),
    labelIds: z.array(z.string()).optional(),
  }),
});

export const gmailMessageRefSchema = z.object({
  id: z.string().min(1),
  threadId: z.string().min(1),
  labelIds: z.array(z.string()).optional(),
});

export type GmailMessage = z.infer<typeof gmailMessageSchema>;
export type GmailThread = z.infer<typeof gmailThreadSchema>;
export type GmailDraft = z.infer<typeof gmailDraftSchema>;
export type GmailMessageRef = z.infer<typeof gmailMessageRefSchema>;

export interface GmailDraftRef {
  draftId: string;
  messageId: string;
  threadId: string;
}

export interface GmailDraftMime extends GmailDraftRef {
  rawMime: string;
}

export interface GmailAdapter {
  readonly mode: ProviderMode;
  readThread(threadId: string): Promise<GmailThread>;
  createDraft(input: { threadId: string; rawMime: string }): Promise<GmailDraft>;
  getDraftMime(draftId: string): Promise<GmailDraftMime>;
  listDrafts(): Promise<GmailDraftRef[]>;
  sendDraft(input: {
    draftId: string;
    threadId: string;
    rawMime: string;
  }): Promise<GmailMessageRef>;
  findMessagesByRfc822MessageId(rfc822MessageId: string): Promise<GmailMessageRef[]>;
}

export const githubIssueSchema = z.object({
  id: z.number().int().positive(),
  number: z.number().int().positive(),
  title: z.string().min(1),
  body: z.string().nullable(),
  state: z.enum(["open", "closed"]),
  html_url: z.url(),
  labels: z.array(z.string()),
  updated_at: z.string().min(1),
});

export const githubCommentSchema = z.object({
  id: z.number().int().positive(),
  body: z.string(),
  html_url: z.url(),
  created_at: z.string().min(1),
});

export type GitHubIssue = z.infer<typeof githubIssueSchema>;
export type GitHubComment = z.infer<typeof githubCommentSchema>;

export interface GitHubAdapter {
  readonly mode: ProviderMode;
  readIssue(issueNumber: number): Promise<GitHubIssue>;
  createIssue(input: { title: string; body: string }): Promise<GitHubIssue>;
  listIssues(): Promise<GitHubIssue[]>;
  createComment(issueNumber: number, body: string): Promise<GitHubComment>;
  listComments(issueNumber: number): Promise<GitHubComment[]>;
}

export const slackMessageSchema = z.object({
  ts: z.string().min(1),
  text: z.string(),
  user: z.string().optional(),
  thread_ts: z.string().min(1).optional(),
});

export type SlackMessage = z.infer<typeof slackMessageSchema>;

export interface SlackPostInput {
  text: string;
  threadTs?: string;
  blocks?: readonly Record<string, unknown>[];
}

export interface SlackAdapter {
  readonly mode: ProviderMode;
  readonly channelId: string;
  readMessages(limit: number): Promise<SlackMessage[]>;
  readReplies(threadTs: string, limit: number): Promise<SlackMessage[]>;
  postMessage(input: SlackPostInput): Promise<SlackMessage>;
}
