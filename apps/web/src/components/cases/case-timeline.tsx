import { LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { GetCaseResponse } from "@rectify/core";
import { buildTimeline, sourceLabel } from "@/lib/case-timeline";
import { formatTime } from "@/lib/format";
import { EnvironmentBadge } from "@/components/workspace/environment-badge";
import { ToneDot } from "@/components/workspace/status-pill";
import { Panel } from "./panel";

export function CaseTimeline({ data }: { data: GetCaseResponse }) {
  const entries = buildTimeline(data);

  return (
    <Panel
      title="Timeline"
      aside={<span className="text-xs text-neutral-500">Observed records only</span>}
    >
      {entries.length === 0 ? (
        <p className="text-sm text-neutral-500">Nothing has been recorded for this case yet.</p>
      ) : (
        <ol className="relative flex flex-col gap-5 pl-5">
          <span className="absolute top-2 bottom-2 left-[3px] w-px bg-white/10" />
          {entries.map((entry) => (
            <li key={entry.id} className="relative flex flex-col gap-1">
              <span className="absolute top-1.5 -left-5">
                <ToneDot tone={entry.tone} />
              </span>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                <span className="font-medium text-neutral-300">{sourceLabel[entry.source]}</span>
                <span>{formatTime(entry.at)}</span>
                {entry.environment && <EnvironmentBadge environment={entry.environment} />}
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm text-white">{entry.title}</span>
                  <span className="text-sm break-words text-neutral-500">{entry.detail}</span>
                </div>
                {entry.href && (
                  <a
                    href={entry.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${sourceLabel[entry.source]} source`}
                    className="shrink-0 text-neutral-500 transition-colors hover:text-accent-300"
                  >
                    <HugeiconsIcon icon={LinkSquare02Icon} size={16} />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
