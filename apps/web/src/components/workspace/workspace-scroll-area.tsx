"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

export function WorkspaceScrollArea({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const area = useRef<HTMLDivElement>(null);

  useEffect(() => {
    area.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div
      ref={area}
      className="no-scrollbar min-h-0 flex-1 px-5 pt-6 pb-8 lg:overflow-y-auto lg:px-8 lg:pt-0"
    >
      {children}
    </div>
  );
}
