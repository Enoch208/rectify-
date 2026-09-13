"use client";

import Link from "next/link";
import { InboxIcon } from "@hugeicons/core-free-icons";
import { getCasesResponseSchema, type CaseSummary } from "@rectify/core";
import { useContract } from "@/lib/api/use-contract";
import {
  caseStateStatus,
  engineeringStatus,
  notificationStatus,
  recoveryStatus,
} from "@/lib/case-presentation";
import { formatTime } from "@/lib/format";
import { ContractView } from "@/components/workspace/contract-view";
import { EmptyState } from "@/components/workspace/empty-state";
import { EnvironmentBadge } from "@/components/workspace/environment-badge";
import { StatusPill } from "@/components/workspace/status-pill";
import { RefreshButton } from "./refresh-button";

export function CaseList() {
  const { result, refresh } = useContract("/api/cases", getCasesResponseSchema);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <RefreshButton onRefresh={refresh} />
      </div>
      <ContractView result={result} label="Cases">
        {({ cases }) =>
          cases.length === 0 ? (
            <EmptyState
              icon={InboxIcon}
              title="No cases yet"
              description="Open a case from an authorized Gmail thread to start."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {cases.map((summary) => (
                <CaseRow key={summary.id} summary={summary} />
              ))}
            </ul>
          )
        }
      </ContractView>
    </div>
  );
}

function CaseRow({ summary }: { summary: CaseSummary }) {
  return (
    <li>
      <Link
        href={`/cases/${summary.id}`}
        className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-[#0A0A0A] p-5 transition-colors hover:border-accent-500/25 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-3">
            <span className="truncate text-sm font-medium text-white">{summary.contactEmail}</span>
            <StatusPill status={caseStateStatus[summary.state]} />
          </div>
          <span className="text-xs text-neutral-500">
            Tenant {summary.tenantId} · {summary.workflow} · updated {formatTime(summary.updatedAt)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill
            status={{
              ...engineeringStatus(summary),
              label: `Eng · ${engineeringStatus(summary).label}`,
            }}
          />
          <StatusPill status={notificationStatus(summary)} />
          <StatusPill status={recoveryStatus(summary)} />
          <EnvironmentBadge environment={summary.environment} />
        </div>
      </Link>
    </li>
  );
}
