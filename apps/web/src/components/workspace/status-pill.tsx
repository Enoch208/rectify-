import type { Status, Tone } from "@/lib/case-presentation";

const toneClass = {
  neutral: "border-white/10 bg-white/[0.04] text-neutral-300",
  progress: "border-accent-500/25 bg-accent-500/10 text-accent-200",
  attention: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  done: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  blocked: "border-rose-400/25 bg-rose-400/10 text-rose-200",
} as const satisfies Record<Tone, string>;

const dotClass = {
  neutral: "bg-neutral-500",
  progress: "bg-accent-400",
  attention: "bg-amber-400",
  done: "bg-emerald-400",
  blocked: "bg-rose-400",
} as const satisfies Record<Tone, string>;

export function StatusPill({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${toneClass[status.tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass[status.tone]}`} />
      {status.label}
    </span>
  );
}

export function ToneDot({ tone }: { tone: Tone }) {
  return <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass[tone]}`} />;
}
