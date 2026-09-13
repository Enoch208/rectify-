"use client";

import Link from "next/link";
import { Activity01Icon } from "@hugeicons/core-free-icons";
import { getRunsResponseSchema, providerSchema, type RunRecord } from "@rectify/core";
import { useContract } from "@/lib/api/use-contract";
import { sourceLabel } from "@/lib/case-timeline";
import { formatDuration, formatTime } from "@/lib/format";
import { RefreshButton } from "@/components/cases/refresh-button";
import { ContractView } from "@/components/workspace/contract-view";
import { EmptyState } from "@/components/workspace/empty-state";
import { EnvironmentBadge } from "@/components/workspace/environment-badge";
import { StatusPill } from "@/components/workspace/status-pill";
import { runStatus } from "./run-status";

export function RunList() {
  const { result, refresh } = useContract("/api/runs", getRunsResponseSchema);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <RefreshButton onRefresh={refresh} />
      </div>
      <ContractView result={result} label="Runs">
        {({ runs }) =>
          runs.length === 0 ? (
            <EmptyState
              icon={Activity01Icon}
              title="No runs recorded"
              description="Runs appear after an agent turn or evaluation trial actually executes."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {runs.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </ul>
          )
        }
      </ContractView>
    </div>
  );
}

function RunRow({ run }: { run: RunRecord }) {
  return (
    <li>
      <Link
        href={`/runs/${encodeURIComponent(run.id)}`}
        className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-[#0A0A0A] p-5 transition-colors hover:border-accent-500/25 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-3">
            <span className="truncate font-mono text-sm text-white">{run.id}</span>
            <StatusPill status={runStatus[run.status]} />
          </div>
          <span className="text-xs text-neutral-500">
            Case {run.caseId} · {run.modelId} · started {formatTime(run.startedAt)} ·{" "}
            {formatDuration(run.durationMs)} · {String(run.toolCallCount)} tool calls
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {providerSchema.options.map((provider) => (
            <span key={provider} className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              {sourceLabel[provider]}
              <EnvironmentBadge environment={run.environments[provider]} />
            </span>
          ))}
        </div>
      </Link>
    </li>
  );
}
