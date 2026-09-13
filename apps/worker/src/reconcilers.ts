import type { ActionRecord } from "@rectify/core";
import {
  reconcileGitHubComment,
  reconcileGitHubIssue,
  reconcileGmailDraft,
  reconcileGmailSend,
  reconcileSlackMessage,
  type GitHubAdapter,
  type GmailAdapter,
  type SlackAdapter,
} from "@rectify/providers";
import { actionKinds } from "./action-keys.ts";
import { moveCase, payloadNumber, payloadString } from "./case-flow.ts";
import type { WorkerServices } from "./services.ts";
import type { ActionReconciler } from "./worker.ts";

export const createReconcilers = (adapters: {
  gmail: GmailAdapter;
  github: GitHubAdapter;
  slack: SlackAdapter;
}): ReadonlyMap<string, ActionReconciler> => {
  const threadOf = (action: ActionRecord): string | null => {
    const value = action.payload.threadTs;
    return typeof value === "string" ? value : null;
  };
  return new Map<string, ActionReconciler>([
    [
      `github:${actionKinds.impactIssue}`,
      (action) => reconcileGitHubIssue(adapters.github, action.logicalKey),
    ],
    [
      `slack:${actionKinds.slackHandoff}`,
      (action) => reconcileSlackMessage(adapters.slack, action.logicalKey, null),
    ],
    [
      `gmail:${actionKinds.customerDraft}`,
      (action) => reconcileGmailDraft(adapters.gmail, action.logicalKey),
    ],
    [
      `slack:${actionKinds.approvalRequest}`,
      (action) => reconcileSlackMessage(adapters.slack, action.logicalKey, null),
    ],
    [
      `gmail:${actionKinds.customerSend}`,
      (action) => reconcileGmailSend(adapters.gmail, payloadString(action, "rfc822MessageId")),
    ],
    [
      `github:${actionKinds.recoveryComment}`,
      (action) =>
        reconcileGitHubComment(
          adapters.github,
          payloadNumber(action, "issueNumber"),
          action.logicalKey,
        ),
    ],
    [
      `slack:${actionKinds.recoveryUpdate}`,
      (action) => reconcileSlackMessage(adapters.slack, action.logicalKey, threadOf(action)),
    ],
  ]);
};

export const applyReconciliation = (
  services: WorkerServices,
  actions: readonly ActionRecord[],
): void => {
  for (const action of actions.filter((candidate) => candidate.status === "CONFIRMED")) {
    const record = services.store.cases.getCase(action.caseId);
    if (
      action.kind === actionKinds.customerSend &&
      record.notificationState === "OUTCOME_UNKNOWN"
    ) {
      moveCase(services, record.id, {
        state: "WAITING_CUSTOMER",
        notificationState: "SENT",
        needsHumanReason: null,
        resumeState: null,
      });
    }
    if (
      (action.kind === actionKinds.recoveryComment || action.kind === actionKinds.recoveryUpdate) &&
      record.syncState === "OUTCOME_UNKNOWN"
    ) {
      moveCase(services, record.id, { syncState: "PENDING" });
    }
  }
};
