"use client";

import Link from "next/link";
import { getRunResponseSchema, providerSchema, type GetRunResponse } from "@rectify/core";
import { useContract } from "@/lib/api/use-contract";
import { actionStateStatus, verificationStatus } from "@/lib/case-presentation";
import { sourceLabel } from "@/lib/case-timeline";
import { formatCount, formatDuration, formatTime } from "@/lib/format";
import { Field, Panel } from "@/components/cases/panel";
import { ContractView } from "@/components/workspace/contract-view";
import { EnvironmentBadge } from "@/components/workspace/environment-badge";
import { StatusPill } from "@/components/workspace/status-pill";
import { runStatus } from "./run-status";

export function RunDetail({ runId }: { runId: string }) {
  const { result } = useContract(`/api/runs/${encodeURIComponent(runId)}`, getRunResponseSchema);

  return (
    <ContractView result={result} label="Run">
      {(data) => <RunRecordView data={data} />}
    </ContractView>
  );
}

function RunRecordView({ data }: { data: GetRunResponse }) {
  const { run } = data;

  return (
    <div className="flex flex-col gap-6">
      <Panel title={`Run ${run.id}`} aside={<StatusPill status={runStatus[run.status]} />}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Field label="Case">
            <Link href={`/cases/${run.caseId}`} className="text-accent-300 hover:text-accent-200">
              {run.caseId}
            </Link>
          </Field>
          <Field label="Commit">
            <span className="font-mono text-xs">{run.commit}</span>
          </Field>
          <Field label="Model">{run.modelId}</Field>
          <Field label="Prompt revision">{run.promptRevision}</Field>
          <Field label="Started">{formatTime(run.startedAt)}</Field>
          <Field label="Duration">{formatDuration(run.durationMs)}</Field>
          <Field label="Tool calls">{String(run.toolCallCount)}</Field>
          <Field label="Tokens in / out">
            {formatCount(run.inputTokens)} / {formatCount(run.outputTokens)}
          </Field>
          <Field label="Trace">{run.traceId ?? "No trace recorded"}</Field>
          <Field label="Stop reason">{run.stopReason ?? "None"}</Field>
        </div>
      </Panel>

      <Panel title="Provider environments">
        <div className="flex flex-wrap gap-4">
          {providerSchema.options.map((provider) => (
            <div key={provider} className="flex items-center gap-2 text-sm text-neutral-300">
              <span>{sourceLabel[provider]}</span>
              <EnvironmentBadge environment={run.environments[provider]} />
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Actions">
          {data.actions.length === 0 ? (
            <p className="text-sm text-neutral-500">No actions recorded in this run.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.actions.map((action) => (
                <li key={action.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-neutral-300">
                    {sourceLabel[action.provider]} · {action.kind}
                  </span>
                  <StatusPill status={actionStateStatus[action.status]} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Verifications">
          {data.verifications.length === 0 ? (
            <p className="text-sm text-neutral-500">No verifications recorded in this run.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.verifications.map((verification) => (
                <li
                  key={verification.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-neutral-300">{formatTime(verification.verifiedAt)}</span>
                  <StatusPill status={verificationStatus(verification)} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
