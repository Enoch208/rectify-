import type {
  ActionState,
  CaseRecord,
  CaseState,
  CaseSummary,
  VerificationRecord,
} from "@rectify/core";

export type Tone = "neutral" | "progress" | "attention" | "done" | "blocked";

export interface Status {
  readonly label: string;
  readonly tone: Tone;
}

export const caseStateStatus = {
  NEW: { label: "New", tone: "neutral" },
  INVESTIGATING: { label: "Investigating", tone: "progress" },
  WAITING_ENGINEERING: { label: "Waiting on engineering", tone: "attention" },
  READY_FOR_APPROVAL: { label: "Ready for approval", tone: "progress" },
  WAITING_CUSTOMER: { label: "Waiting on customer", tone: "progress" },
  RECOVERED: { label: "Recovered", tone: "done" },
  NEEDS_HUMAN: { label: "Needs a human", tone: "blocked" },
} as const satisfies Record<CaseState, Status>;

export const actionStateStatus = {
  PLANNED: { label: "Planned", tone: "neutral" },
  AUTHORIZED: { label: "Authorized", tone: "progress" },
  DISPATCHING: { label: "Dispatching", tone: "progress" },
  CONFIRMED: { label: "Confirmed", tone: "done" },
  OUTCOME_UNKNOWN: { label: "Outcome unknown", tone: "blocked" },
  REJECTED: { label: "Rejected", tone: "attention" },
  CONFIRMED_FAILED: { label: "Failed", tone: "blocked" },
} as const satisfies Record<ActionState, Status>;

type CaseFacts = Pick<
  CaseSummary,
  "engineeringState" | "notificationState" | "recoveryState" | "syncState"
>;

export function engineeringStatus(facts: CaseFacts): Status {
  switch (facts.engineeringState) {
    case "UNKNOWN":
      return { label: "Unknown", tone: "neutral" };
    case "OPEN":
      return { label: "Open", tone: "attention" };
    case "CLOSED":
      return { label: "Closed", tone: "neutral" };
  }
}

export function verificationStatus(verification: VerificationRecord | undefined): Status {
  if (verification === undefined) {
    return { label: "Not run", tone: "neutral" };
  }
  switch (verification.result) {
    case "PASS":
      return { label: "Passing", tone: "done" };
    case "FAIL":
      return { label: "Still failing", tone: "blocked" };
    case "INCONCLUSIVE":
      return { label: "Inconclusive", tone: "attention" };
  }
}

export function notificationStatus(facts: CaseFacts): Status {
  switch (facts.notificationState) {
    case "NOT_DRAFTED":
      return { label: "Not drafted", tone: "neutral" };
    case "DRAFTED":
      return { label: "Drafted", tone: "progress" };
    case "AWAITING_APPROVAL":
      return { label: "Awaiting approval", tone: "attention" };
    case "APPROVED":
      return { label: "Approved, not sent", tone: "progress" };
    case "SENT":
      return { label: "Sent", tone: "done" };
    case "OUTCOME_UNKNOWN":
      return { label: "Send outcome unknown", tone: "blocked" };
  }
}

export function recoveryStatus(facts: CaseFacts): Status {
  if (facts.recoveryState === "NOT_OBSERVED") {
    return { label: "Not observed", tone: "neutral" };
  }
  switch (facts.syncState) {
    case "NOT_REQUIRED":
    case "COMPLETE":
      return { label: "Recovery observed", tone: "done" };
    case "PENDING":
      return { label: "Recovery observed · Slack update pending", tone: "attention" };
    case "OUTCOME_UNKNOWN":
      return { label: "Recovery observed · update outcome unknown", tone: "blocked" };
  }
}

export function nextAction(record: CaseRecord): string {
  switch (record.state) {
    case "NEW":
      return "Start an investigation.";
    case "INVESTIGATING":
      return "An investigation turn is running.";
    case "WAITING_ENGINEERING":
      return "Engineering applies the fix, then recheck the customer workflow.";
    case "READY_FOR_APPROVAL":
      return "An approver signs off on the exact customer message in Slack.";
    case "WAITING_CUSTOMER":
      return "Waiting for the customer to complete the export themselves.";
    case "RECOVERED":
      return record.syncState === "COMPLETE" || record.syncState === "NOT_REQUIRED"
        ? "Nothing. Recovery observed and provider updates confirmed."
        : "Finish the remaining provider updates.";
    case "NEEDS_HUMAN":
      return record.needsHumanReason ?? "A human decision is required.";
  }
}

export function canInvestigate(state: CaseState): boolean {
  return state === "NEW";
}

export function canRecheck(state: CaseState): boolean {
  return state === "WAITING_ENGINEERING" || state === "NEEDS_HUMAN";
}
