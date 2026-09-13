import type { Metadata } from "next";
import { InboxIcon } from "@hugeicons/core-free-icons";
import { EmptyState } from "@/components/workspace/empty-state";
import { PageHeading } from "@/components/workspace/page-heading";

export const metadata: Metadata = { title: "Cases" };

export default function CasesPage() {
  return (
    <>
      <PageHeading
        title="Cases"
        description="Customer issues followed from complaint to observed recovery."
      />
      <EmptyState
        icon={InboxIcon}
        title="Case data is not connected"
        description="Cases appear here once the case API is available and an operator opens a case from a Gmail thread."
      />
    </>
  );
}
