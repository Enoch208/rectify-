import Image, { type StaticImageData } from "next/image";
import arga from "@/assets/sponsors/arga.png";
import comma from "@/assets/sponsors/comma.png";
import lemma from "@/assets/sponsors/lemma.png";

interface Sponsor {
  readonly name: string;
  readonly href: string;
  readonly logo: StaticImageData;
  readonly height: string;
  readonly showName: boolean;
}

const sponsors: readonly Sponsor[] = [
  { name: "Lemma", href: "https://www.uselemma.ai/", logo: lemma, height: "h-7", showName: false },
  { name: "Comma Capital", href: "https://comma.vc/", logo: comma, height: "h-7", showName: true },
  {
    name: "Arga Labs",
    href: "https://www.argalabs.com/",
    logo: arga,
    height: "h-6",
    showName: false,
  },
];

export function SponsorStrip() {
  return (
    <section
      id="built-at"
      className="animate-on-scroll [animation:fadeInUp_0.8s_ease-out_0.2s_both] animate scroll-mt-32 rounded-3xl border border-white/5 bg-white/[0.02] px-6 py-12 text-center"
    >
      <p className="mb-8 text-[10px] tracking-wider text-neutral-500 uppercase">
        Built at the Multi-App AI Agent Hackathon
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-16 gap-y-8">
        {sponsors.map(({ name, href, logo, height, showName }) => (
          <a
            key={name}
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label={name}
            className="flex items-center gap-3 opacity-60 transition-opacity hover:opacity-100"
          >
            <Image src={logo} alt="" className={`${height} w-auto brightness-0 invert`} />
            {showName && (
              <span className="font-[family-name:var(--font-manrope)] text-xl font-bold text-white">
                {name}
              </span>
            )}
          </a>
        ))}
      </div>
    </section>
  );
}
