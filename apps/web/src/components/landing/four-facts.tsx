import {
  CodeIcon,
  MailSend01Icon,
  TestTube01Icon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons";
import { FeatureCard, type Feature } from "./feature-card";
import { SectionHeading } from "./section-heading";

const facts: readonly Feature[] = [
  {
    eyebrow: "01",
    title: "Engineering finished",
    description: "What GitHub and Slack claim. Recorded as a statement, never as proof.",
    icon: CodeIcon,
  },
  {
    eyebrow: "02",
    title: "Workflow verified",
    description:
      "Rectify runs the customer’s real export for their tenant and checks the exact expected records.",
    icon: TestTube01Icon,
  },
  {
    eyebrow: "03",
    title: "Customer notified",
    description: "An approved message is sent. Sending is not the same as the customer succeeding.",
    icon: MailSend01Icon,
  },
  {
    eyebrow: "04",
    title: "Recovery observed",
    description: "Only the product server seeing the customer complete the task closes the loop.",
    icon: UserCheck01Icon,
  },
];

export function FourFacts() {
  return (
    <section id="how-it-works" className="mb-32 scroll-mt-32">
      <SectionHeading
        title="Four facts, never merged"
        description="Most tools close a customer issue when a ticket closes. Rectify keeps each fact separate and only moves forward on evidence."
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {facts.map((fact) => (
          <FeatureCard key={fact.title} feature={fact} />
        ))}
      </div>
    </section>
  );
}
