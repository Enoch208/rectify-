import { GithubIcon, Mail01Icon, SlackIcon } from "@hugeicons/core-free-icons";
import Image from "next/image";
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
      <div className="animate-on-scroll [animation:fadeInUp_0.8s_ease-out_0.25s_both] animate relative -mx-6 mb-8 overflow-hidden bg-[#050505] sm:mx-0">
        <Image
          src="/images/landing/evidence-constellation.webp"
          alt="Email, engineering, and conversation evidence converging into one verified case"
          width={2048}
          height={768}
          sizes="(max-width: 1280px) 100vw, 1280px"
          className="aspect-[16/6] w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />
        <div className="absolute right-5 bottom-5 left-5 flex items-end justify-between gap-6 text-[10px] tracking-[0.18em] text-white/60 uppercase md:right-8 md:bottom-7 md:left-8">
          <span>02 · Evidence constellation</span>
          <span className="max-w-48 text-right">One case across three apps</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {lanes.map((lane) => (
          <FeatureCard key={lane.eyebrow} feature={lane} />
        ))}
      </div>
    </section>
  );
}
