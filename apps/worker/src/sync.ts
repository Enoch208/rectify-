import type { ActionRecord, CaseRecord } from "@rectify/core";
import { actionKeys, actionKinds, MAX_SYNC_ATTEMPTS } from "./action-keys.ts";
import {
  allowed,
  denied,
  describeError,
  executeOnce,
  moveCase,
  payloadNumber,
  payloadString,
} from "./case-flow.ts";
import { recoveryText } from "./messages.ts";
import type { WorkerServices } from "./services.ts";
import type { ActionExecutor } from "./worker.ts";

type Target =
  { provider: "github"; issueNumber: number } | { provider: "slack"; threadTs: string | null };

const confirmedProviderId = (services: WorkerServices, logicalKey: string): string | null => {
  const action = services.store.ledger.getByLogicalKey(logicalKey);
  return action?.status === "CONFIRMED" ? (action.providerIds[0] ?? null) : null;
};

const withAttempts = async (
  services: WorkerServices,
  record: CaseRecord,
  target: Target,
  requestId: string,
): Promise<ActionRecord | null> => {
  let latest: ActionRecord | null = null;
  for (let attempt = 1; attempt <= MAX_SYNC_ATTEMPTS; attempt += 1) {
    const key =
      target.provider === "github"
        ? actionKeys.recoveryComment(record.id, attempt)
        : actionKeys.recoveryUpdate(record.id, attempt);
    const execute: ActionExecutor = async (action) => {
      if (target.provider === "github") {
        const comment = await services.github.createComment(
          payloadNumber(action, "issueNumber"),
          payloadString(action, "text"),
        );
        return { providerIds: [String(comment.id), comment.html_url] };
      }
      const threadTs = action.payload.threadTs;
      const message = await services.slack.postMessage({
        text: payloadString(action, "text"),
        ...(typeof threadTs === "string" ? { threadTs } : {}),
      });
      return { providerIds: [message.ts] };
    };
    latest = await executeOnce(
      services,
      () => ({
        caseId: record.id,
        logicalKey: key,
        provider: target.provider,
        kind:
          target.provider === "github" ? actionKinds.recoveryComment : actionKinds.recoveryUpdate,
        payload: {
          text: recoveryText(record, requestId, key),
          ...(target.provider === "github"
            ? { issueNumber: target.issueNumber }
            : target.threadTs === null
              ? {}
              : { threadTs: target.threadTs }),
        },
      }),
      () => {
        const current = services.store.cases.getCase(record.id);
        return Promise.resolve(
          current.state === "RECOVERED" && current.recoveryState === "OBSERVED"
            ? allowed
            : denied("Recovery updates require observed customer recovery"),
        );
      },
      execute,
      key,
    );
    if (latest.status !== "CONFIRMED_FAILED") {
      return latest;
    }
  }
  return latest;
};

const synchronize = async (services: WorkerServices, record: CaseRecord): Promise<void> => {
  const data = services.store.cases.getCaseResponse(record.id);
  const event = data.outcomeEvents
    .filter((candidate) => candidate.actorType === "CUSTOMER" && candidate.result === "SUCCEEDED")
    .at(-1);
  if (event === undefined) {
    return;
  }
  const impactIssue = confirmedProviderId(services, actionKeys.impactIssue(record.id));
  const issueNumber = Number(impactIssue ?? record.matchedEngineeringIssueId);
  if (!Number.isSafeInteger(issueNumber) || issueNumber < 1) {
    moveCase(services, record.id, {
      needsHumanReason: "Recovery observed but no GitHub issue is available to update.",
    });
    return;
  }
  const github = await withAttempts(
    services,
    record,
    { provider: "github", issueNumber },
    event.requestId,
  );
  const slack = await withAttempts(
    services,
    services.store.cases.getCase(record.id),
    {
      provider: "slack",
      threadTs: confirmedProviderId(services, actionKeys.slackHandoff(record.id)),
    },
    event.requestId,
  );
  const statuses = [github?.status, slack?.status];
  if (statuses.every((status) => status === "CONFIRMED")) {
    moveCase(services, record.id, { syncState: "COMPLETE", needsHumanReason: null });
  } else if (statuses.includes("OUTCOME_UNKNOWN")) {
    moveCase(services, record.id, { syncState: "OUTCOME_UNKNOWN" });
  }
};

export const synchronizeRecoveries = async (services: WorkerServices): Promise<void> => {
  const pending = services.store.cases
    .listByState("RECOVERED")
    .filter((record) => record.syncState === "PENDING");
  for (const record of pending) {
    try {
      await synchronize(services, record);
    } catch (error: unknown) {
      console.error(
        `Recovery synchronization for case ${record.id} failed: ${describeError(error)}`,
      );
    }
  }
};
