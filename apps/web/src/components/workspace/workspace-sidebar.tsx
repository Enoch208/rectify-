import Link from "next/link";
import { Activity01Icon, ArrowLeft01Icon, InboxIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Wordmark } from "@/components/landing/site-logo";
import { workspaceRoutes } from "@/lib/workspace-routes";
import { SidebarLink } from "./sidebar-link";

export function WorkspaceSidebar() {
  return (
    <aside className="no-scrollbar hidden h-full w-72 shrink-0 flex-col overflow-y-auto border-r border-white/5 bg-[#070707] p-8 lg:flex">
      <Link href="/" aria-label="Rectify home" className="mb-10 flex items-center pl-2">
        <Wordmark />
      </Link>

      <nav className="flex-1 space-y-1">
        <SidebarLink label="Cases" href={workspaceRoutes.cases} icon={InboxIcon} />
        <SidebarLink label="Evaluation runs" href={workspaceRoutes.runs} icon={Activity01Icon} />
      </nav>

      <div className="mt-auto border-t border-white/5 pt-8">
        <Link
          href="/"
          className="flex w-full items-center gap-3 px-3 py-2 text-neutral-500 transition-colors hover:text-white"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          <span className="text-sm font-medium">Back to site</span>
        </Link>
      </div>
    </aside>
  );
}
