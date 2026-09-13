import type { EnvironmentLabel, GetCaseResponse, Provider } from "@rectify/core";
import { actionStateStatus, verificationStatus, type Tone } from "./case-presentation";

export interface TimelineEntry {
  readonly id: string;
  readonly at: string;
  readonly source: Provider | "rectify";
  readonly title: string;
  readonly detail: string;
  readonly tone: Tone;
  readonly environment: EnvironmentLabel | null;
  readonly href: string | null;
}

export const sourceLabel = {
  gmail: "Gmail",
  github: "GitHub",
  slack: "Slack",
  reportdesk: "ReportDesk",
  rectify: "Rectify",
} as const satisfies Record<TimelineEntry["source"], string>;

const decisionTone = {
  PENDING: "attention",
  APPROVED: "done",
  REJECTED: "blocked",
  REVOKED: "blocked",
} as const satisfies Record<GetCaseResponse["approvals"][number]["decision"], Tone>;

export function buildTimeline(response: GetCaseResponse): readonly TimelineEntry[] {
  const evidence = response.evidence.map<TimelineEntry>((record) => ({
    id: `evidence-${record.id}`,
    at: record.retrievedAt,
    source: record.provider,
    title: record.factKind === "REPORTED" ? "Source claims" : "Observed",
    detail: record.fact,
    tone: record.factKind === "REPORTED" ? "neutral" : "progress",
    environment: record.environment,
    href: record.sourceUrl,
  }));

  const verifications = response.verifications.map<TimelineEntry>((record) => {
    const status = verificationStatus(record);
    const http =
      record.observed.httpStatus === null
        ? "no response"
        : `HTTP ${String(record.observed.httpStatus)}`;
    return {
      id: `verification-${record.id}`,
      at: record.verifiedAt,
      source: "reportdesk",
      title: `Export check · ${status.label}`,
      detail: `${http} · ${String(record.observed.rows.length)} of ${String(record.expected.rows.length)} expected rows${record.observed.failureReason === null ? "" : ` · ${record.observed.failureReason}`}`,
      tone: status.tone,
      environment: null,
      href: null,
    };
  });

  const actions = response.actions.map<TimelineEntry>((record) => {
    const status = actionStateStatus[record.status];
    const reason = record.uncertaintyReason ?? record.error;
    return {
      id: `action-${record.id}`,
      at: record.updatedAt,
      source: record.provider,
      title: `${record.kind} · ${status.label}`,
      detail: reason ?? `Attempts: ${String(record.attempts.length)}`,
      tone: status.tone,
      environment: null,
      href: null,
    };
  });

  const approvals = response.approvals.map<TimelineEntry>((record) => ({
    id: `approval-${record.id}`,
    at: record.createdAt,
    source: "slack",
    title: `Approval request · ${record.decision.toLowerCase()}`,
    detail: `“${record.subject}” to ${record.recipients.join(", ")}`,
    tone: decisionTone[record.decision],
    environment: null,
    href: null,
  }));

  const outcomes = response.outcomeEvents.map<TimelineEntry>((record) => ({
    id: `outcome-${record.eventId}`,
    at: record.occurredAt,
    source: "reportdesk",
    title: `${record.actorType === "CUSTOMER" ? "Customer" : "Probe"} export · ${record.result.toLowerCase()}`,
    detail: `Request ${record.requestId} · config revision ${String(record.configRevision)}`,
    tone: record.result === "SUCCEEDED" ? "done" : "blocked",
    environment: null,
    href: null,
  }));

  return [...evidence, ...verifications, ...actions, ...approvals, ...outcomes].sort(
    (left, right) => Date.parse(left.at) - Date.parse(right.at),
  );
}
