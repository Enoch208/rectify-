import { AppLanes } from "@/components/landing/app-lanes";
import { BackgroundEffects } from "@/components/landing/background-effects";
import { FalseResolution } from "@/components/landing/false-resolution";
import { FourFacts } from "@/components/landing/four-facts";
import { Guardrails } from "@/components/landing/guardrails";
import { Hero } from "@/components/landing/hero";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { SponsorStrip } from "@/components/landing/sponsor-strip";

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden pt-32">
      <BackgroundEffects />
      <SiteNav />
      <main id="top" className="relative mx-auto max-w-7xl px-6 pt-12 pb-32">
        <Hero />
        <FalseResolution />
        <FourFacts />
        <AppLanes />
        <Guardrails />
        <SponsorStrip />
      </main>
      <SiteFooter />
      <ScrollReveal />
    </div>
  );
}
