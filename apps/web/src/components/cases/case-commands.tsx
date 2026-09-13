"use client";

import { useState } from "react";
import { queuedJobResponseSchema, type CaseRecord, type QueuedJobResponse } from "@rectify/core";
import { describeFailure, postContract, type CommandResult } from "@/lib/api/contract";
import { canInvestigate, canRecheck } from "@/lib/case-presentation";
import { Panel } from "./panel";

type Command = "investigate" | "recheck";

function commandMessage(result: CommandResult<QueuedJobResponse>): string {
  switch (result.kind) {
    case "accepted":
      return `Queued as job ${result.data.jobId}. The case updates when the worker records a result.`;
    case "not-connected":
      return `${result.path} is not available yet.`;
    case "unauthorized":
      return `Sign in required: ${result.message}`;
    case "rejected":
      return `Rejected (${String(result.status)}): ${result.message}`;
  }
}

export function CaseCommands({ record, onChanged }: { record: CaseRecord; onChanged: () => void }) {
  const [pending, setPending] = useState<Command | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = (command: Command) => {
    setPending(command);
    setMessage(null);
    postContract(
      `/api/cases/${encodeURIComponent(record.id)}/${command}`,
      {},
      queuedJobResponseSchema,
    )
      .then(
        (result) => {
          setMessage(commandMessage(result));
          if (result.kind === "accepted") {
            onChanged();
          }
        },
        (error: unknown) => {
          setMessage(describeFailure(error));
        },
      )
      .finally(() => {
        setPending(null);
      });
  };

  const buttons: readonly { command: Command; label: string; enabled: boolean }[] = [
    { command: "investigate", label: "Investigate", enabled: canInvestigate(record) },
    { command: "recheck", label: "Recheck workflow", enabled: canRecheck(record) },
  ];

  return (
    <Panel title="Actions">
      <div className="flex flex-wrap gap-2">
        {buttons.map(({ command, label, enabled }) => (
          <button
            key={command}
            type="button"
            disabled={!enabled || pending !== null}
            onClick={() => {
              run(command);
            }}
            className="rounded-full bg-white px-4 py-2 text-xs font-medium text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-500"
          >
            {pending === command ? "Sending…" : label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        {message ?? "Buttons mirror server policy; the server decides what actually runs."}
      </p>
    </Panel>
  );
}
