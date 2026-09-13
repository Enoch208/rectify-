import {
  createGitHubAdapter,
  createGmailAdapter,
  createSlackAdapter,
  modeFromEnvironment,
  requiredEnvironment,
  type GitHubAdapter,
  type GmailAdapter,
  type SlackAdapter,
} from "@rectify/providers";
import type { IntakeEntry } from "@rectify/store";
import { demoIssues, demoSlackMessages, demoThreads } from "./demo-fixtures.ts";
import { RefreshingGmailAdapter } from "./gmail-oauth.ts";

const optional = (name: string): string | null => {
  const value = process.env[name];
  return value === undefined || value.length === 0 ? null : value;
};

export const createGmailFromEnvironment = (intake: readonly IntakeEntry[]): GmailAdapter => {
  const mode = modeFromEnvironment(process.env.GMAIL_MODE, "GMAIL_MODE");
  const allowedThreadIds = [...new Set(intake.map((entry) => entry.gmailThreadId))];
  if (mode === "local_fixture") {
    return createGmailAdapter({ mode, threads: demoThreads });
  }
  if (mode === "arga") {
    return createGmailAdapter({
      mode,
      accessToken: requiredEnvironment("GMAIL_ARGA_TOKEN"),
      baseUrl: requiredEnvironment("GMAIL_ARGA_BASE_URL"),
      allowedThreadIds,
    });
  }
  const refreshToken = optional("GMAIL_OAUTH_REFRESH_TOKEN");
  if (refreshToken !== null) {
    return new RefreshingGmailAdapter({
      clientId: requiredEnvironment("GMAIL_OAUTH_CLIENT_ID"),
      clientSecret: requiredEnvironment("GMAIL_OAUTH_CLIENT_SECRET"),
      refreshToken,
      allowedThreadIds,
    });
  }
  return createGmailAdapter({
    mode,
    accessToken: requiredEnvironment("GMAIL_ACCESS_TOKEN"),
    allowedThreadIds,
  });
};

export const createGitHubFromEnvironment = (): GitHubAdapter => {
  const mode = modeFromEnvironment(process.env.GITHUB_MODE, "GITHUB_MODE");
  const owner = requiredEnvironment("GITHUB_OWNER");
  const repo = requiredEnvironment("GITHUB_REPO");
  if (mode === "local_fixture") {
    return createGitHubAdapter({ mode, owner, repo, issues: demoIssues });
  }
  if (mode === "arga") {
    return createGitHubAdapter({
      mode,
      owner,
      repo,
      accessToken: requiredEnvironment("GITHUB_ARGA_TOKEN"),
      baseUrl: requiredEnvironment("GITHUB_ARGA_BASE_URL"),
    });
  }
  return createGitHubAdapter({
    mode,
    owner,
    repo,
    accessToken: requiredEnvironment("GITHUB_TOKEN"),
  });
};

export const createSlackFromEnvironment = (): SlackAdapter => {
  const mode = modeFromEnvironment(process.env.SLACK_MODE, "SLACK_MODE");
  const channelId = requiredEnvironment("SLACK_CHANNEL_ID");
  if (mode === "local_fixture") {
    return createSlackAdapter({ mode, channelId, messages: demoSlackMessages });
  }
  if (mode === "arga") {
    return createSlackAdapter({
      mode,
      channelId,
      accessToken: requiredEnvironment("SLACK_ARGA_TOKEN"),
      baseUrl: requiredEnvironment("SLACK_ARGA_BASE_URL"),
    });
  }
  return createSlackAdapter({ mode, channelId, accessToken: requiredEnvironment("SLACK_TOKEN") });
};

export const optionalEnvironment = optional;
