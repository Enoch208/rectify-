import type { ReactNode } from "react";

export function Panel({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/5 bg-[#0A0A0A] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-white">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] tracking-wider text-neutral-600 uppercase">{label}</span>
      <div className="text-sm break-words text-neutral-300">{children}</div>
    </div>
  );
}
