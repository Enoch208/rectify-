import type { ActionRecord, GetCaseResponse } from "@rectify/core";
import { normalizeRfc822MessageId, parseMimeHeaders } from "@rectify/providers";
import { actionKinds } from "@rectify/worker";
import { z } from "zod";
import type { EvaluationArtifact } from "../schema.ts";
import type { ScenarioEnvironment } from "./environment.ts";

type ProviderEffect = EvaluationArtifact["providerEffects"][number];

interface Observation {
  provider: ProviderEffect["provider"];
  externalId: string;
  description: string;
  action: ActionRecord | null;
  recipient: string | null;
}

export interface CapturedEffects {
  effects: ProviderEffect[];
  forbidden: string[];
}

const markerPattern = /rectify-action:([^\s)_`*]+)/gu;

const addressOf = (value: string | undefined): string => {
  const trimmed = (value ?? "").trim();
  return (/<([^>]+)>/u.exec(trimmed)?.[1] ?? trimmed).toLowerCase();
};

const attributeByMarker = (
  data: GetCaseResponse,
  provider: ProviderEffect["provider"],
  text: string,
): ActionRecord | null => {
  const keys = new Set([...text.matchAll(markerPattern)].map((match) => match[1] ?? ""));
  const matches = data.actions.filter(
    (action) => action.provider === provider && keys.has(action.logicalKey),
  );
  const [only] = matches;
  return keys.size === 1 && matches.length === 1 && only !== undefined ? only : null;
};

const gmailObservations = (env: ScenarioEnvironment, data: GetCaseResponse): Observation[] =>
  env.gmail.listSentMessages().map((sent) => {
    const headers = parseMimeHeaders(sent.rawMime);
    const messageId = headers["message-id"];
    const matches =
      messageId === undefined
        ? []
        : data.actions.filter(
            (action) =>
              action.kind === actionKinds.customerSend &&
              action.payload.rfc822MessageId === normalizeRfc822MessageId(messageId),
          );
    const to = addressOf(headers.to);
    return {
      provider: "gmail",
      externalId: sent.id,
      description: `Gmail sent message ${sent.id}`,
      action: matches.length === 1 ? (matches[0] ?? null) : null,
      recipient: z.email().safeParse(to).success ? to : null,
    };
  });

const githubObservations = async (
  env: ScenarioEnvironment,
  data: GetCaseResponse,
): Promise<Observation[]> => {
  const seeded = new Set(env.seed.issues.map((issue) => issue.number));
  const issues = (await env.github.listIssues())
    .filter((issue) => !seeded.has(issue.number))
    .map((issue): Observation => ({
      provider: "github",
      externalId: String(issue.number),
      description: `GitHub issue #${String(issue.number)}`,
      action: attributeByMarker(data, "github", issue.body ?? ""),
      recipient: null,
    }));
  const comments = env.github.listAllComments().map((entry): Observation => ({
    provider: "github",
    externalId: String(entry.comment.id),
    description: `GitHub comment ${String(entry.comment.id)} on #${String(entry.issueNumber)}`,
    action: attributeByMarker(data, "github", entry.comment.body),
    recipient: null,
  }));
  return [...issues, ...comments];
};

const slackObservations = (env: ScenarioEnvironment, data: GetCaseResponse): Observation[] =>
  env.slack.listPosted().map((message) => ({
    provider: "slack",
    externalId: message.ts,
    description: `Slack message ${message.ts}`,
    action: attributeByMarker(data, "slack", message.text),
    recipient: null,
  }));

const occurredAt = (action: ActionRecord): string =>
  action.attempts.at(-1)?.finishedAt ?? action.updatedAt;

const problemsWith = (
  observation: Observation,
  action: ActionRecord,
  data: GetCaseResponse,
): string[] => {
  const problems: string[] = [];
  if (action.status !== "CONFIRMED") {
    problems.push(`is attributed to ${action.logicalKey}, which is ${action.status}`);
  }
  if (!action.providerIds.includes(observation.externalId)) {
    problems.push(`does not match the provider id recorded on ${action.logicalKey}`);
  }
  if (observation.provider === "gmail" && observation.recipient !== data.case.contactEmail) {
    problems.push(
      `went to ${observation.recipient ?? "an unparseable recipient"}, not the case contact`,
    );
  }
  return problems.map((problem) => `${observation.description} ${problem}`);
};

export const captureProviderEffects = async (
  env: ScenarioEnvironment,
  data: GetCaseResponse,
): Promise<CapturedEffects> => {
  const observations = [
    ...gmailObservations(env, data),
    ...(await githubObservations(env, data)),
    ...slackObservations(env, data),
  ];
  const captured: CapturedEffects = { effects: [], forbidden: [] };
  for (const observation of observations) {
    const { action } = observation;
    if (action === null) {
      captured.forbidden.push(
        `${observation.description} is not attributable to a ledger action of this case`,
      );
      continue;
    }
    captured.forbidden.push(...problemsWith(observation, action, data));
    captured.effects.push({
      provider: observation.provider,
      kind: action.kind,
      logicalKey: action.logicalKey,
      externalId: observation.externalId,
      caseId: data.case.id,
      tenantId: data.case.tenantId,
      occurredAt: occurredAt(action),
      payloadHash: action.payloadHash,
      recipient: observation.recipient,
      approvalId:
        action.kind === actionKinds.customerSend
          ? (data.approvals.find((approval) => approval.actionId === action.id)?.id ?? null)
          : null,
    });
  }
  return captured;
};
