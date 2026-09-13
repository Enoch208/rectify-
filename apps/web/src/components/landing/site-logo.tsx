import Image from "next/image";
import wordmark from "@/assets/rectify-wordmark.png";

export function SiteLogo({ preload = false }: { preload?: boolean }) {
  return (
    <a href="#top" aria-label="Rectify home" className="inline-flex h-[36px] items-center">
      <Wordmark preload={preload} />
    </a>
  );
}

export function Wordmark({ preload = false }: { preload?: boolean }) {
  return <Image src={wordmark} alt="Rectify" preload={preload} className="h-[18px] w-auto" />;
}
