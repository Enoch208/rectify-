import type { CaseRecord, VerificationRecord } from "@rectify/core";
import {
  engineeringStatus,
  notificationStatus,
  recoveryStatus,
  verificationStatus,
  type Status,
} from "@/lib/case-presentation";
import { StatusPill } from "@/components/workspace/status-pill";

function verificationNote(verification: VerificationRecord | undefined): string {
  if (verification === undefined) {
    return "The customer workflow has not been checked.";
  }
  const http =
    verification.observed.httpStatus === null
      ? "No response"
      : `HTTP ${String(verification.observed.httpStatus)}`;
  return `${http} · ${String(verification.observed.rows.length)} of ${String(verification.expected.rows.length)} expected rows`;
}

export function StatusCards({
  record,
  latestVerification,
}: {
  record: CaseRecord;
  latestVerification: VerificationRecord | undefined;
}) {
  const cards: readonly { title: string; status: Status; note: string }[] = [
    {
      title: "Engineering",
      status: engineeringStatus(record),
      note: record.matchedEngineeringIssueId
        ? `Issue ${record.matchedEngineeringIssueId}. A status, not proof.`
        : "No engineering issue matched yet.",
    },
    {
      title: "Verification",
      status: verificationStatus(latestVerification),
      note: verificationNote(latestVerification),
    },
    {
      title: "Notification",
      status: notificationStatus(record),
      note: "Sending is not delivery, and not recovery.",
    },
    {
      title: "Recovery",
      status: recoveryStatus(record),
      note: "Only a customer export seen by the product server counts.",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ title, status, note }) => (
        <div
          key={title}
          className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-[#0A0A0A] p-5"
        >
          <span className="text-[10px] tracking-wider text-neutral-500 uppercase">{title}</span>
          <StatusPill status={status} />
          <span className="text-xs leading-relaxed text-neutral-500">{note}</span>
        </div>
      ))}
    </div>
  );
}
