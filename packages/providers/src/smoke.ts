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

const confirmReadback = (provider: string, found: boolean, detail: string): void => {
  if (!found) {
    throw new Error(`${provider} read-back did not find the smoke write (${detail})`);
  }
};

const run = async (): Promise<void> => {
  const nonce = randomUUID();
  process.stdout.write(`Rectify provider smoke ${new Date().toISOString()} correlation ${nonce}\n`);
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
  const storedDraft = await gmail.getDraftMime(draft.id);
  confirmReadback("Gmail", storedDraft.rawMime.includes(nonce), `draft ${draft.id}`);
  report("Gmail", gmail.mode, `read back draft ${storedDraft.draftId} containing the correlation`);

  const github = createGitHubAdapter(githubSmokeConfig());
  const issueNumber = Number.parseInt(requiredEnvironment("GITHUB_READ_ISSUE_NUMBER"), 10);
  const sourceIssue = await github.readIssue(issueNumber);
  report("GitHub", github.mode, `read issue ${String(sourceIssue.number)}`);
  const issue = await github.createIssue({
    title: `Rectify provider smoke ${nonce}`,
    body: `Controlled write from the Rectify provider smoke command. Correlation: ${nonce}`,
  });
  report("GitHub", github.mode, `created issue ${String(issue.number)} at ${issue.html_url}`);
  const storedIssue = await github.readIssue(issue.number);
  confirmReadback(
    "GitHub",
    storedIssue.body?.includes(nonce) === true,
    `issue ${String(issue.number)}`,
  );
  report(
    "GitHub",
    github.mode,
    `read back issue ${String(storedIssue.number)} containing the correlation`,
  );

  const slack = createSlackAdapter(slackSmokeConfig());
  const messages = await slack.readMessages(1);
  report("Slack", slack.mode, `read ${String(messages.length)} message`);
  const message = await slack.postMessage({ text: `Rectify provider smoke ${nonce}` });
  report("Slack", slack.mode, `posted message ${message.ts}`);
  const recent = await slack.readMessages(20);
  confirmReadback(
    "Slack",
    recent.some((candidate) => candidate.ts === message.ts && candidate.text.includes(nonce)),
    `message ${message.ts}`,
  );
  report("Slack", slack.mode, `read back message ${message.ts} containing the correlation`);
  process.stdout.write(
    "Provider smoke passed: read, write and read-back confirmed for every provider\n",
  );
};

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown provider smoke failure";
  process.stderr.write(`Provider smoke failed: ${message}\n`);
  process.exitCode = 1;
});
