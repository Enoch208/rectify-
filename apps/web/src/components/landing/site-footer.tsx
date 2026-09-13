import { landingSections, repositoryUrl } from "@/lib/site";
import { SiteLogo } from "./site-logo";

interface FooterLink {
  readonly label: string;
  readonly href: string;
  readonly external?: boolean;
}

const footerColumns: readonly { heading: string; links: readonly FooterLink[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "The gap", href: landingSections.gap },
      { label: "How it works", href: landingSections.howItWorks },
      { label: "Guardrails", href: landingSections.guardrails },
    ],
  },
  {
    heading: "Build",
    links: [
      { label: "GitHub", href: repositoryUrl, external: true },
      { label: "Lemma", href: "https://www.uselemma.ai/", external: true },
      { label: "Arga Labs", href: "https://www.argalabs.com/", external: true },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative border-t border-white/5 bg-[#020202] pt-24 pb-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 flex flex-col justify-between gap-12 md:flex-row">
          <div className="max-w-xs">
            <div className="mb-4">
              <SiteLogo />
            </div>
            <p className="text-xs leading-relaxed text-neutral-500">
              Rectify follows a customer issue from complaint to observed recovery, across Gmail,
              GitHub and Slack, and never mistakes a closed ticket for a customer who can work
              again.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-16 gap-y-10 text-xs text-neutral-500">
            {footerColumns.map(({ heading, links }) => (
              <div key={heading} className="flex flex-col gap-4">
                <span className="font-semibold text-white">{heading}</span>
                {links.map(({ label, href, external }) => (
                  <a
                    key={label}
                    href={href}
                    className="hover:text-white"
                    {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                  >
                    {label}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 border-t border-white/5 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] text-neutral-600">© 2026 Rectify</p>
          <div className="flex items-center gap-4">
            <div className="h-1.5 w-1.5 rounded-full bg-accent-500" />
            <span className="text-[10px] text-neutral-500">
              Hackathon prototype · fictional customers and synthetic data
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
