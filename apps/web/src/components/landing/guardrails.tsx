import { DatabaseIcon, LockIcon, SecurityCheckIcon, UserIcon } from "@hugeicons/core-free-icons";
import Image from "next/image";
import { FeatureCard, type Feature } from "./feature-card";
import { SectionHeading } from "./section-heading";

const guardrails: readonly Feature[] = [
  {
    eyebrow: "Approval",
    title: "Consent binds the exact message",
    description:
      "Recipient, subject, body and the passing check are sealed into the approval. Any change needs a new one.",
    icon: LockIcon,
  },
  {
    eyebrow: "Identity",
    title: "Customers come from a trusted directory",
    description:
      "Names and signatures in an email can’t pick the tenant or add a recipient. Ambiguity goes to a human.",
    icon: UserIcon,
  },
  {
    eyebrow: "Writes",
    title: "Intent is saved before every write",
    description:
      "If a send’s response is lost, Rectify checks the provider before acting and never blindly retries.",
    icon: DatabaseIcon,
  },
  {
    eyebrow: "Content",
    title: "App content is untrusted input",
    description:
      "Instructions hidden in emails or issue comments can’t bypass approval or widen what the agent can touch.",
    icon: SecurityCheckIcon,
  },
];

export function Guardrails() {
  return (
    <section id="guardrails" className="mb-32 scroll-mt-32">
      <SectionHeading
        title="The model proposes. Policy decides."
        description="The agent searches, compares evidence and drafts. Server-side policy authorizes every action, and observed evidence is the only thing that changes a case."
      />
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="animate-on-scroll [animation:fadeInUp_0.8s_ease-out_0.25s_both] animate relative min-h-80 overflow-hidden bg-[#050505] lg:min-h-full">
          <Image
            src="/images/landing/approval-binding.webp"
            alt="A customer message passing through a single protected approval path"
            fill
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="object-cover object-center"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
          <div className="absolute right-5 bottom-5 left-5 flex items-end justify-between gap-6 text-[10px] tracking-[0.18em] text-white/60 uppercase md:right-7 md:bottom-7 md:left-7">
            <span>03 · Approval binding</span>
            <span className="max-w-40 text-right">One exact message</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {guardrails.map((guardrail) => (
            <FeatureCard key={guardrail.title} feature={guardrail} />
          ))}
        </div>
      </div>
    </section>
  );
}
