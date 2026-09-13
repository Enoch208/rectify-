export function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="animate-on-scroll [animation:fadeInUp_0.8s_ease-out_0.2s_both] animate mb-12">
      <h2 className="mb-2 text-3xl font-medium tracking-tight text-white">{title}</h2>
      <p className="max-w-2xl text-sm text-neutral-500">{description}</p>
    </div>
  );
}
