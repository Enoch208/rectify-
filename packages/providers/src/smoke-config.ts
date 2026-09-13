import { modeFromEnvironment, requiredEnvironment } from "./config.ts";
import type { GitHubConfig } from "./github.ts";
import type { GmailConfig } from "./gmail.ts";
import type { SlackConfig } from "./slack.ts";

export const gmailSmokeConfig = (): GmailConfig => {
  const mode = modeFromEnvironment(process.env.GMAIL_MODE, "GMAIL_MODE");
  const threadId = requiredEnvironment("GMAIL_THREAD_ID");
  if (mode === "local_fixture") {
    return {
      mode,
      threads: [{ id: threadId, messages: [{ id: "fixture-message-1", threadId }] }],
    };
  }
  if (mode === "live") {
    return {
      mode,
      accessToken: requiredEnvironment("GMAIL_ACCESS_TOKEN"),
      userId: "me",
      allowedThreadIds: [threadId],
    };
  }
  return {
    mode,
    accessToken: requiredEnvironment("GMAIL_ARGA_TOKEN"),
    baseUrl: requiredEnvironment("GMAIL_ARGA_BASE_URL"),
    userId: "me",
    allowedThreadIds: [threadId],
  };
};

export const githubSmokeConfig = (): GitHubConfig => {
  const mode = modeFromEnvironment(process.env.GITHUB_MODE, "GITHUB_MODE");
  const owner = requiredEnvironment("GITHUB_OWNER");
  const repo = requiredEnvironment("GITHUB_REPO");
  if (mode === "local_fixture") {
    const issueNumber = Number.parseInt(requiredEnvironment("GITHUB_READ_ISSUE_NUMBER"), 10);
    return {
      mode,
      owner,
      repo,
      issues: [
        {
          id: issueNumber,
          number: issueNumber,
          title: "Fixture provider smoke source",
          body: "Read by the explicitly selected fixture adapter.",
          state: "open",
          html_url: `https://github.local/${owner}/${repo}/issues/${String(issueNumber)}`,
        },
      ],
    };
  }
  if (mode === "live") {
    return { mode, accessToken: requiredEnvironment("GITHUB_TOKEN"), owner, repo };
  }
  return {
    mode,
    accessToken: requiredEnvironment("GITHUB_ARGA_TOKEN"),
    baseUrl: requiredEnvironment("GITHUB_ARGA_BASE_URL"),
    owner,
    repo,
  };
};

export const slackSmokeConfig = (): SlackConfig => {
  const mode = modeFromEnvironment(process.env.SLACK_MODE, "SLACK_MODE");
  const channelId = requiredEnvironment("SLACK_CHANNEL_ID");
  if (mode === "local_fixture") {
    return {
      mode,
      channelId,
      messages: [{ ts: "1.000000", text: "Fixture provider smoke source" }],
    };
  }
  if (mode === "live") {
    return { mode, accessToken: requiredEnvironment("SLACK_TOKEN"), channelId };
  }
  return {
    mode,
    accessToken: requiredEnvironment("SLACK_ARGA_TOKEN"),
    baseUrl: requiredEnvironment("SLACK_ARGA_BASE_URL"),
    channelId,
  };
};
