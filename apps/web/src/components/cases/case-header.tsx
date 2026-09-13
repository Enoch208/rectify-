import type { GetCaseResponse, VerificationRecord } from "@rectify/core";
import { caseStateStatus, nextAction } from "@/lib/case-presentation";
import { evidenceEnvironments } from "@/lib/case-timeline";
import { formatTime } from "@/lib/format";
import { EnvironmentBadge } from "@/components/workspace/environment-badge";
import { StatusPill } from "@/components/workspace/status-pill";
import { Field } from "./panel";

export function CaseHeader({
  data,
  latestVerification,
}: {
  data: GetCaseResponse;
  latestVerification: VerificationRecord | undefined;
}) {
  const record = data.case;
  const complaint = data.evidence.find(
    (entry) => entry.provider === "gmail" && entry.factKind === "REPORTED",
  );
  const environments = evidenceEnvironments(data);

  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-white/5 bg-[#0A0A0A] p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="truncate text-2xl font-medium tracking-tight text-white">
              {record.contactEmail}
            </h2>
            <StatusPill status={caseStateStatus[record.state]} />
          </div>
          <p className="max-w-2xl text-sm text-neutral-400">
            {complaint
              ? (complaint.redactedContent ?? complaint.fact)
              : "Complaint not retrieved yet."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          {environments.length === 0 ? (
            <EnvironmentBadge environment="NOT RUN" />
          ) : (
            environments.map((environment) => (
              <EnvironmentBadge key={environment} environment={environment} />
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-5 lg:grid-cols-4">
        <Field label="Tenant">{record.tenantId}</Field>
        <Field label="Workflow">
          {record.workflow} · v{String(record.workflowVersion)}
        </Field>
        <Field label="Last verification">
          {latestVerification ? formatTime(latestVerification.verifiedAt) : "Not run"}
        </Field>
        <Field label="Next action">
          <span className={record.state === "NEEDS_HUMAN" ? "text-rose-200" : "text-white"}>
            {nextAction(record)}
          </span>
        </Field>
      </div>
    </section>
  );
}
