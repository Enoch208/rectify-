import type { Metadata } from "next";
import { RunDetail } from "@/components/runs/run-detail";
import { PageHeading } from "@/components/workspace/page-heading";

export const metadata: Metadata = { title: "Run" };

export default async function RunPage({ params }: PageProps<"/runs/[id]">) {
  const { id } = await params;

  return (
    <>
      <PageHeading
        title="Run detail"
        description="Configuration, environments, actions and verifications recorded for one run."
      />
      <RunDetail runId={id} />
    </>
  );
}
