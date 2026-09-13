import type { Metadata } from "next";
import { Activity01Icon } from "@hugeicons/core-free-icons";
import { EmptyState } from "@/components/workspace/empty-state";
import { PageHeading } from "@/components/workspace/page-heading";

export const metadata: Metadata = { title: "Evaluation runs" };

export default function RunsPage() {
  return (
    <>
      <PageHeading
        title="Evaluation runs"
        description="Scenario trials with configuration, environment, provider state and verdict."
      />
      <EmptyState
        icon={Activity01Icon}
        title="No run records are connected"
        description="Runs appear here after the evaluation suite writes its results. Nothing is shown until a run has actually happened."
      />
    </>
  );
}
