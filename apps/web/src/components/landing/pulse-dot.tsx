export function PulseDot() {
  return (
    <span className="relative flex h-1.5 w-1.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-75" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-500" />
    </span>
  );
}
