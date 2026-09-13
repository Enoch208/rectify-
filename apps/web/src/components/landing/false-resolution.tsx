import Image from "next/image";

type Tone = "claimed" | "failing";

const readout: readonly { source: string; label: string; value: string; tone: Tone }[] = [
  { source: "GitHub", label: "Engineering issue", value: "Closed", tone: "claimed" },
  { source: "Slack", label: "Rollout message", value: "“Rollout complete”", tone: "claimed" },
  { source: "ReportDesk", label: "Export response", value: "HTTP 200", tone: "claimed" },
  {
    source: "Rectify check",
    label: "Customer workflow",
    value: "Still failing · expected records missing",
    tone: "failing",
  },
];

const toneClass: Record<Tone, string> = {
  claimed: "text-neutral-300",
  failing: "text-accent-300",
};

export function FalseResolution() {
  return (
    <section
      id="the-gap"
      className="animate-on-scroll [animation:fadeInUp_0.8s_ease-out_0.5s_both] animate mx-auto mb-32 max-w-6xl scroll-mt-32"
    >
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="relative min-h-80 overflow-hidden bg-[#050505] lg:order-1 lg:min-h-full">
          <Image
            src="/images/landing/closed-versus-fixed.webp"
            alt="An empty fractured export transformed into a verified export with complete rows"
            fill
            sizes="(max-width: 1024px) 100vw, 58vw"
            className="object-cover object-center"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
          <div className="absolute right-5 bottom-5 left-5 flex justify-between text-[10px] tracking-[0.18em] text-white/60 uppercase">
            <span>Status</span>
            <span>Observed proof</span>
          </div>
        </div>
        <div className="overflow-hidden rounded-3xl border border-white/5 bg-[#0A0A0A] lg:order-2">
          <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
            <span className="text-xs font-medium text-white">Northstar Research · CSV export</span>
            <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] tracking-wider text-neutral-500 uppercase">
              Demo scenario
            </span>
          </div>
          <ul className="divide-y divide-white/5">
            {readout.map(({ source, label, value, tone }) => (
              <li key={label} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="flex flex-col">
                  <span className="text-[10px] tracking-wider text-neutral-600 uppercase">
                    {source}
                  </span>
                  <span className="text-sm text-neutral-400">{label}</span>
                </div>
                <span className={`text-right font-mono text-sm ${toneClass[tone]}`}>{value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-neutral-500">
        Every system says it’s fixed. The customer still can’t export. Rectify runs the customer’s
        workflow instead of trusting a status.
      </p>
    </section>
  );
}
