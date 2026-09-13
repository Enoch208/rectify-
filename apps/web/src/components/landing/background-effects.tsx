export function BackgroundEffects() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <div className="grid-lines absolute inset-0 mx-auto max-w-7xl border-x border-white/[0.03]" />
      <div className="absolute top-0 left-1/2 h-[500px] w-[80vw] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,_var(--accent-glow),_transparent_70%)] opacity-70 blur-3xl" />
    </div>
  );
}
