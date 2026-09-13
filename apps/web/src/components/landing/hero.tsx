import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import Image from "next/image";
import { landingSections } from "@/lib/site";
import { PulseDot } from "./pulse-dot";

export function Hero() {
  return (
    <section className="mb-28">
      <div className="mx-auto max-w-4xl text-center">
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

      <div className="animate-on-scroll [animation:fadeInUp_1s_ease-out_0.5s_both] animate relative -mx-6 mt-20 overflow-hidden bg-[#050505] sm:mx-0">
        <Image
          src="/images/landing/recovery-engine.webp"
          alt="Fragmented records passing through a verification engine and emerging complete"
          width={1586}
          height={992}
          priority
          sizes="(max-width: 1280px) 100vw, 1280px"
          className="aspect-[16/8] w-full object-cover object-center"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
        <div className="absolute right-5 bottom-5 left-5 flex items-end justify-between gap-6 text-[10px] tracking-[0.18em] text-white/60 uppercase md:right-8 md:bottom-8 md:left-8">
          <span>01 · Recovery engine</span>
          <span className="max-w-52 text-right">Complaint to observed success</span>
        </div>
      </div>
    </section>
  );
}
