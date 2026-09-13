import { randomUUID } from "node:crypto";
import { requiredEnvironment } from "./config.ts";
import { providerEnvironmentByMode } from "./contracts.ts";
import { createGitHubAdapter } from "./github.ts";
import { createGmailAdapter } from "./gmail.ts";
import { githubSmokeConfig, gmailSmokeConfig, slackSmokeConfig } from "./smoke-config.ts";
import { createSlackAdapter } from "./slack.ts";

const report = (
  provider: string,
  mode: keyof typeof providerEnvironmentByMode,
  detail: string,
): void => {
  process.stdout.write(`${provider} [${providerEnvironmentByMode[mode]}] ${detail}\n`);
};

const run = async (): Promise<void> => {
  const nonce = randomUUID();
  const gmail = createGmailAdapter(gmailSmokeConfig());
  const gmailThreadId = requiredEnvironment("GMAIL_THREAD_ID");
  const gmailThread = await gmail.readThread(gmailThreadId);
  report("Gmail", gmail.mode, `read thread ${gmailThread.id}`);
  const recipient = requiredEnvironment("GMAIL_SMOKE_TO");
  const rawMime = [
    `To: ${recipient}`,
    `Subject: Rectify provider smoke ${nonce}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    `Rectify Gmail draft smoke ${nonce}`,
  ].join("\r\n");
  const draft = await gmail.createDraft({ threadId: gmailThreadId, rawMime });
  report("Gmail", gmail.mode, `created draft ${draft.id}`);

  const github = createGitHubAdapter(githubSmokeConfig());
  const issueNumber = Number.parseInt(requiredEnvironment("GITHUB_READ_ISSUE_NUMBER"), 10);
  const sourceIssue = await github.readIssue(issueNumber);
  report("GitHub", github.mode, `read issue ${String(sourceIssue.number)}`);
  const issue = await github.createIssue({
    title: `Rectify provider smoke ${nonce}`,
    body: `Controlled write from the Rectify provider smoke command. Correlation: ${nonce}`,
  });
  report("GitHub", github.mode, `created issue ${String(issue.number)} at ${issue.html_url}`);

  const slack = createSlackAdapter(slackSmokeConfig());
  const messages = await slack.readMessages(1);
  report("Slack", slack.mode, `read ${String(messages.length)} message`);
  const message = await slack.postMessage({ text: `Rectify provider smoke ${nonce}` });
  report("Slack", slack.mode, `posted message ${message.ts}`);
};

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown provider smoke failure";
  process.stderr.write(`Provider smoke failed: ${message}\n`);
  process.exitCode = 1;
});
