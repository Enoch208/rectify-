import { DatabaseIcon, LockIcon, SecurityCheckIcon, UserIcon } from "@hugeicons/core-free-icons";
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
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {guardrails.map((guardrail) => (
          <FeatureCard key={guardrail.title} feature={guardrail} />
        ))}
      </div>
    </section>
  );
}
