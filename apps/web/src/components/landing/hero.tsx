import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { landingSections } from "@/lib/site";
import { PulseDot } from "./pulse-dot";

export function Hero() {
  return (
    <div className="mx-auto mb-20 max-w-4xl text-center">
      <div className="animate-on-scroll [animation:fadeInUp_0.8s_ease-out_0.1s_both] animate mb-8 inline-flex items-center gap-2 rounded-full border border-accent-500/20 bg-accent-950/20 px-3 py-1 text-[10px] font-medium tracking-wider text-accent-200 uppercase shadow-[0_0_15px_var(--accent-glow)]">
        <PulseDot />
        Customer-resolution agent
      </div>

      <h1 className="animate-on-scroll [animation:fadeInUp_0.8s_ease-out_0.2s_both] animate mb-6 text-5xl leading-[0.95] font-medium tracking-tight text-white md:text-7xl md:leading-none">
        Closed isn’t
        <br />
        <span className="text-neutral-500">fixed.</span>
      </h1>

      <p className="animate-on-scroll [animation:fadeInUp_0.8s_ease-out_0.3s_both] animate mx-auto mb-10 max-w-xl text-lg leading-relaxed font-light tracking-tight text-neutral-400">
        Rectify carries a customer issue across Gmail, GitHub and Slack, runs the customer’s own
        workflow to check it really works, and follows through until recovery is observed.
      </p>

      <div className="animate-on-scroll [animation:fadeInUp_0.8s_ease-out_0.4s_both] animate flex justify-center">
        <a
          href={landingSections.howItWorks}
          className="group relative flex items-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-medium text-black transition-all hover:bg-gray-200"
        >
          <span>See how a case closes</span>
          <HugeiconsIcon
            icon={ArrowRight02Icon}
            size={16}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </a>
      </div>
    </div>
  );
}
