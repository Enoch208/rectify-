import { GithubIcon, Mail01Icon, SlackIcon } from "@hugeicons/core-free-icons";
import { FeatureCard, type Feature } from "./feature-card";
import { SectionHeading } from "./section-heading";

const lanes: readonly Feature[] = [
  {
    eyebrow: "Gmail",
    title: "Complaint to reply",
    description:
      "Opens the case from the customer’s thread, drafts the reply, and sends only the exact message a human approved.",
    icon: Mail01Icon,
  },
  {
    eyebrow: "GitHub",
    title: "Evidence to handoff",
    description:
      "Matches the engineering issue, then opens one customer-impact issue with expected versus observed results.",
    icon: GithubIcon,
  },
  {
    eyebrow: "Slack",
    title: "Handoff to approval",
    description:
      "Tells engineering what is still failing and asks an approver to sign off on the exact customer message.",
    icon: SlackIcon,
  },
];

export function AppLanes() {
  return (
    <section className="mb-32">
      <SectionHeading
        title="One case, three apps"
        description="Rectify works where your team already does. Each app gets a narrow set of actions, checked on the server before anything is written."
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {lanes.map((lane) => (
          <FeatureCard key={lane.eyebrow} feature={lane} />
        ))}
      </div>
    </section>
  );
}
