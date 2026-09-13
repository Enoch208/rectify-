import { z } from "zod";

export const providerModeSchema = z.enum(["live", "arga", "local_fixture"]);
export type ProviderMode = z.infer<typeof providerModeSchema>;

export const providerEnvironmentByMode = {
  live: "LIVE PROVIDER",
  arga: "ARGA TWIN",
  local_fixture: "LOCAL FIXTURE",
} as const satisfies Record<ProviderMode, string>;

export const gmailThreadSchema = z.object({
  id: z.string().min(1),
  historyId: z.string().min(1).optional(),
  messages: z.array(
    z.object({
      id: z.string().min(1),
      threadId: z.string().min(1),
      labelIds: z.array(z.string()).optional(),
      snippet: z.string().optional(),
    }),
  ),
});

export const gmailDraftSchema = z.object({
  id: z.string().min(1),
  message: z.object({
    id: z.string().min(1),
    threadId: z.string().min(1),
    labelIds: z.array(z.string()).optional(),
  }),
});

export type GmailThread = z.infer<typeof gmailThreadSchema>;
export type GmailDraft = z.infer<typeof gmailDraftSchema>;

export interface GmailAdapter {
  readonly mode: ProviderMode;
  readThread(threadId: string): Promise<GmailThread>;
  createDraft(input: { threadId: string; rawMime: string }): Promise<GmailDraft>;
}

export const githubIssueSchema = z.object({
  id: z.number().int().positive(),
  number: z.number().int().positive(),
  title: z.string().min(1),
  body: z.string().nullable(),
  state: z.enum(["open", "closed"]),
  html_url: z.url(),
});

export type GitHubIssue = z.infer<typeof githubIssueSchema>;

export interface GitHubAdapter {
  readonly mode: ProviderMode;
  readIssue(issueNumber: number): Promise<GitHubIssue>;
  createIssue(input: { title: string; body: string }): Promise<GitHubIssue>;
}

export const slackMessageSchema = z.object({
  ts: z.string().min(1),
  text: z.string(),
  user: z.string().optional(),
});

export type SlackMessage = z.infer<typeof slackMessageSchema>;

export interface SlackAdapter {
  readonly mode: ProviderMode;
  readMessages(limit: number): Promise<SlackMessage[]>;
  postMessage(text: string): Promise<SlackMessage>;
}
