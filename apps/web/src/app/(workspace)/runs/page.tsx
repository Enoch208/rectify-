import type { Metadata } from "next";
import { RunList } from "@/components/runs/run-list";
import { PageHeading } from "@/components/workspace/page-heading";

export const metadata: Metadata = { title: "Evaluation runs" };

export default function RunsPage() {
  return (
    <>
      <PageHeading
        title="Evaluation runs"
        description="Agent turns and scenario trials with configuration, environments and outcome."
      />
      <RunList />
    </>
  );
}
