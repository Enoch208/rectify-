import type { Metadata } from "next";
import { CaseList } from "@/components/cases/case-list";
import { PageHeading } from "@/components/workspace/page-heading";

export const metadata: Metadata = { title: "Cases" };

export default function CasesPage() {
  return (
    <>
      <PageHeading
        title="Cases"
        description="Customer issues followed from complaint to observed recovery."
      />
      <CaseList />
    </>
  );
}
