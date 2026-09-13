export function SiteLogo() {
  return (
    <a href="#top" aria-label="Rectify home" className="inline-flex h-[36px] items-center">
      <Wordmark />
    </a>
  );
}

export function Wordmark() {
  return (
    <span className="font-[family-name:var(--font-manrope)] text-[15px] font-semibold tracking-[0.32em] text-white">
      RECTIFY
    </span>
  );
}
