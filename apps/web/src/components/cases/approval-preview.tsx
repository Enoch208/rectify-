"use client";

import type { ApprovalRecord } from "@rectify/core";
import { useNow } from "@/lib/api/use-contract";
import type { Status } from "@/lib/case-presentation";
import { formatTime, shortHash } from "@/lib/format";
import { StatusPill } from "@/components/workspace/status-pill";
import { Field, Panel } from "./panel";

function approvalStatus(approval: ApprovalRecord, now: number): Status {
  if (approval.consumedAt !== null) {
    return { label: "Used for send", tone: "done" };
  }
  switch (approval.decision) {
    case "PENDING":
      return Date.parse(approval.expiresAt) <= now
        ? { label: "Expired", tone: "blocked" }
        : { label: "Awaiting approver", tone: "attention" };
    case "APPROVED":
      return Date.parse(approval.expiresAt) <= now
        ? { label: "Approved · expired", tone: "blocked" }
        : { label: "Approved", tone: "done" };
    case "REJECTED":
      return { label: "Rejected", tone: "blocked" };
    case "REVOKED":
      return { label: "Revoked", tone: "blocked" };
  }
}

export function ApprovalPreview({ approvals }: { approvals: readonly ApprovalRecord[] }) {
  const now = useNow(15_000);
  const latest = approvals.reduce<ApprovalRecord | undefined>(
    (current, approval) =>
      current === undefined || Date.parse(approval.createdAt) > Date.parse(current.createdAt)
        ? approval
        : current,
    undefined,
  );

  if (latest === undefined) {
    return (
      <Panel title="Customer message">
        <p className="text-sm text-neutral-500">
          No message has been proposed. A draft is only prepared after the workflow check passes.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Customer message" aside={<StatusPill status={approvalStatus(latest, now)} />}>
      <div className="flex flex-col gap-4">
        <Field label="To">{latest.recipients.join(", ")}</Field>
        <Field label="Subject">{latest.subject}</Field>
        <Field label="Body">
          <pre className="max-h-64 overflow-y-auto rounded-xl bg-black/40 p-3 font-sans text-sm whitespace-pre-wrap text-neutral-300">
            {latest.body}
          </pre>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Expires">{formatTime(latest.expiresAt)}</Field>
          <Field label="Config revision">{String(latest.configRevision)}</Field>
          <Field label="Payload hash">
            <span className="font-mono text-xs">{shortHash(latest.businessFieldsHash)}</span>
          </Field>
          <Field label="Approver">{latest.approverId ?? "None yet"}</Field>
        </div>
      </div>
    </Panel>
  );
}
