import type { ReactNode } from "react";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";

export function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon: IconSvgElement;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-20 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/5 text-neutral-400 ring-1 ring-white/10">
        <HugeiconsIcon icon={icon} size={20} />
      </span>
      <div className="flex max-w-md flex-col gap-1">
        <span className="text-base font-medium text-white">{title}</span>
        <span className="text-sm text-neutral-500">{description}</span>
      </div>
      {children}
    </div>
  );
}
