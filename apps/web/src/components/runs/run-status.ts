import type { RunRecord } from "@rectify/core";
import type { Status } from "@/lib/case-presentation";

export const runStatus = {
  RUNNING: { label: "Running", tone: "progress" },
  SUCCEEDED: { label: "Succeeded", tone: "done" },
  FAILED: { label: "Failed", tone: "blocked" },
  STOPPED: { label: "Stopped", tone: "attention" },
} as const satisfies Record<RunRecord["status"], Status>;
