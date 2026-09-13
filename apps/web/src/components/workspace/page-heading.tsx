import type { ReactNode } from "react";

export function PageHeading({
  title,
  description,
  aside,
}: {
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mt-2 mb-8 flex flex-col justify-between gap-3 md:flex-row md:items-end">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-medium tracking-tight text-white">{title}</h2>
        <p className="text-sm text-neutral-500">{description}</p>
      </div>
      {aside}
    </div>
  );
}
