import type { EnvironmentLabel } from "@rectify/core";

const environmentClass = {
  "LIVE PROVIDER": "border-emerald-400/30 text-emerald-300",
  "ARGA TWIN": "border-accent-400/30 text-accent-300",
  "LOCAL FIXTURE": "border-amber-400/30 text-amber-300",
  "RECORDED REPLAY": "border-violet-400/30 text-violet-300",
  "NOT RUN": "border-white/10 text-neutral-500",
} as const satisfies Record<EnvironmentLabel, string>;

export function EnvironmentBadge({ environment }: { environment: EnvironmentLabel }) {
  return (
    <span
      className={`inline-flex rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wider whitespace-nowrap ${environmentClass[environment]}`}
    >
      {environment}
    </span>
  );
}
