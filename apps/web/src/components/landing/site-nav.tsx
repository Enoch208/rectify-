import type { CSSProperties } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { landingSections } from "@/lib/site";
import { SiteLogo } from "./site-logo";

const pillBorder: CSSProperties & Record<"--border-gradient" | "--border-radius-before", string> = {
  "--border-gradient": "linear-gradient(to bottom, rgba(255,255,255,0.2), rgba(255,255,255,0.05))",
  "--border-radius-before": "9999px",
};

const navLinks = [
  { label: "The gap", href: landingSections.gap },
  { label: "How it works", href: landingSections.howItWorks },
  { label: "Guardrails", href: landingSections.guardrails },
] as const;

export function SiteNav() {
  return (
    <div className="animate-on-scroll [animation:fadeInUp_0.8s_ease-out_0s_both] animate fixed top-6 right-0 left-0 z-50 flex justify-center px-6">
      <nav className="flex w-full max-w-5xl items-center justify-between rounded-full border border-white/5 bg-[#050505]/80 p-2 pl-6 shadow-2xl ring-1 ring-white/5 backdrop-blur-xl">
        <SiteLogo />

        <div className="hidden items-center gap-6 text-xs font-medium text-neutral-400 md:flex">
          {navLinks.map(({ label, href }) => (
            <a key={label} href={href} className="transition-colors hover:text-white">
              {label}
            </a>
          ))}
        </div>

        <Link
          href="/cases"
          className="group relative flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-neutral-800"
          style={pillBorder}
        >
          <span>Open workspace</span>
          <HugeiconsIcon icon={ArrowUpRight01Icon} size={12} />
        </Link>
      </nav>
    </div>
  );
}
