"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActiveRoute, workspaceNav } from "@/lib/workspace-routes";

export function WorkspaceMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="no-scrollbar sticky top-0 z-30 flex gap-2 overflow-x-auto border-y border-white/5 bg-[#070707]/95 px-5 py-3 backdrop-blur-md lg:hidden">
      {workspaceNav.map((item) => {
        const active = isActiveRoute(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              active ? "bg-white text-black" : "bg-white/[0.04] text-neutral-400 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
