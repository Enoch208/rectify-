import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";

export interface Feature {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly icon: IconSvgElement;
}

export function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <div className="animate-on-scroll [animation:fadeInUp_0.8s_ease-out_0.3s_both] animate group relative flex flex-col gap-4 rounded-3xl border border-white/5 bg-[#0A0A0A] p-6 transition-colors hover:border-accent-500/20">
      <div className="flex items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-white ring-1 ring-white/10 transition-colors group-hover:text-accent-400">
          <HugeiconsIcon icon={feature.icon} size={18} />
        </span>
        <span className="text-[10px] tracking-wider text-neutral-600 uppercase">
          {feature.eyebrow}
        </span>
      </div>
      <div>
        <h3 className="text-base font-medium text-white">{feature.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-500">{feature.description}</p>
      </div>
    </div>
  );
}
