"use client";

import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActiveRoute, type WorkspaceHref } from "@/lib/workspace-routes";

export function SidebarLink({
  label,
  href,
  icon,
}: {
  label: string;
  href: WorkspaceHref;
  icon: IconSvgElement;
}) {
  const active = isActiveRoute(usePathname(), href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
        active
          ? "bg-white/[0.06] text-white"
          : "text-neutral-500 hover:bg-white/[0.03] hover:text-white"
      }`}
    >
      <HugeiconsIcon icon={icon} size={16} className={active ? "text-accent-400" : ""} />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}
