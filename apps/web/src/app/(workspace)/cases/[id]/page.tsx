import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { CaseWorkspace } from "@/components/cases/case-workspace";

export const metadata: Metadata = { title: "Case" };

export default async function CasePage({ params }: PageProps<"/cases/[id]">) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/cases"
        className="inline-flex w-fit items-center gap-2 text-xs text-neutral-500 transition-colors hover:text-white"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
        All cases
      </Link>
      <CaseWorkspace caseId={id} />
    </div>
  );
}
