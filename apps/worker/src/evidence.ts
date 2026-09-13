import { createHash } from "node:crypto";
import {
  evidenceRecordSchema,
  type CaseRecord,
  type EvidenceRecord,
  type Provider,
  type ProviderEnvironments,
} from "@rectify/core";
import type { GitHubIssue, GmailThread, SlackMessage } from "@rectify/providers";

const REDACTED_LIMIT = 600;

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");

const redact = (value: string): string =>
  value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[email]")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, REDACTED_LIMIT);

interface EvidenceInput {
  provider: Provider;
  sourceId: string;
  sourceUrl: string | null;
  fact: string;
  content: string;
}

export const buildEvidence = (
  record: CaseRecord,
  environments: ProviderEnvironments,
  input: EvidenceInput,
  id: string,
  retrievedAt: string,
): EvidenceRecord =>
  evidenceRecordSchema.parse({
    id,
    caseId: record.id,
    provider: input.provider,
    sourceId: input.sourceId,
    sourceUrl: input.sourceUrl,
    retrievedAt,
    factKind: "REPORTED",
    fact: input.fact.slice(0, 500),
    redactedContent: input.content.length === 0 ? null : redact(input.content),
    contentHash: hash(input.content),
    environment: environments[input.provider],
  });

export const gmailEvidenceInputs = (thread: GmailThread, liveUrl: boolean): EvidenceInput[] =>
  thread.messages.map((message) => {
    const content = message.bodyText ?? message.snippet ?? "";
    return {
      provider: "gmail",
      sourceId: message.id,
      sourceUrl: liveUrl ? `https://mail.google.com/mail/u/0/#all/${thread.id}` : null,
      fact: `Customer thread message${message.subject === null ? "" : ` "${message.subject}"`} reports: ${redact(content).slice(0, 300)}`,
      content,
    };
  });

export const githubEvidenceInput = (issue: GitHubIssue): EvidenceInput => ({
  provider: "github",
  sourceId: String(issue.number),
  sourceUrl: issue.html_url,
  fact: `Engineering issue #${String(issue.number)} "${issue.title}" is ${issue.state} on GitHub. This is a status claim, not proof of customer recovery.`,
  content: `${issue.title}\n\n${issue.body ?? ""}`,
});

export const slackEvidenceInput = (message: SlackMessage): EvidenceInput => ({
  provider: "slack",
  sourceId: message.ts,
  sourceUrl: null,
  fact: `Slack message states: ${redact(message.text).slice(0, 300)}`,
  content: message.text,
});

export const untrustedExcerpt = (value: string): string => redact(value).slice(0, 400);
