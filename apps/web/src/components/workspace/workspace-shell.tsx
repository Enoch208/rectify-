import type { ReactNode } from "react";
import { WorkspaceHeader } from "./workspace-header";
import { WorkspaceMobileNav } from "./workspace-mobile-nav";
import { WorkspaceScrollArea } from "./workspace-scroll-area";
import { WorkspaceSidebar } from "./workspace-sidebar";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen justify-center bg-[#020202] p-3 lg:h-screen lg:p-8">
      <div className="relative flex w-full max-w-[1500px] flex-col overflow-hidden rounded-[28px] border border-white/5 bg-[#070707] shadow-2xl shadow-black/50 lg:h-full lg:flex-row lg:rounded-[40px]">
        <WorkspaceSidebar />
        <main className="flex min-w-0 flex-1 flex-col bg-[#070707] lg:h-full">
          <WorkspaceHeader />
          <WorkspaceMobileNav />
          <WorkspaceScrollArea>{children}</WorkspaceScrollArea>
        </main>
      </div>
    </div>
  );
}
