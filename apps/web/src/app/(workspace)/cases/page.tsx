import type { Metadata } from "next";
import { CaseList } from "@/components/cases/case-list";
import { OpenCaseForm } from "@/components/cases/open-case-form";
import { PageHeading } from "@/components/workspace/page-heading";

export const metadata: Metadata = { title: "Cases" };

export default function CasesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Cases"
        description="Customer issues followed from complaint to observed recovery."
      />
      <OpenCaseForm />
      <CaseList />
    </div>
  );
}
