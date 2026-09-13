import type { ActionRecord, ApprovalRecord } from "@rectify/core";
import { authorizeCustomerSend } from "@rectify/core/policy";
import { StatusError } from "@rectify/store";
import { denied, describeError, intentFromAction, moveCase, requireHuman } from "./case-flow.ts";
import { allowedRecipients } from "./customer-draft.ts";
import { currentDraftFor } from "./current-draft.ts";
import type { WorkerServices } from "./services.ts";

const settleCase = (
  services: WorkerServices,
  approval: ApprovalRecord,
  result: ActionRecord,
): void => {
  switch (result.status) {
    case "CONFIRMED":
      moveCase(services, approval.caseId, { state: "WAITING_CUSTOMER", notificationState: "SENT" });
      return;
    case "OUTCOME_UNKNOWN":
      moveCase(services, approval.caseId, {
        state: "NEEDS_HUMAN",
        notificationState: "OUTCOME_UNKNOWN",
        needsHumanReason: `Customer send outcome is unknown (${result.uncertaintyReason ?? "no response"}). Reconcile with Gmail before any retry.`,
        resumeState: "WAITING_CUSTOMER",
      });
      return;
    case "REJECTED":
      if (approval.consumedAt === null) {
        services.store.approvals.revoke(approval.id);
      }
      requireHuman(
        services,
        approval.caseId,
        `Customer send blocked by policy: ${result.error ?? "rejected"}`,
        "WAITING_ENGINEERING",
      );
      return;
    case "CONFIRMED_FAILED":
      requireHuman(
        services,
        approval.caseId,
        `Gmail refused the customer send: ${result.error ?? "failed"}`,
        "WAITING_ENGINEERING",
      );
      return;
    case "PLANNED":
    case "AUTHORIZED":
    case "DISPATCHING":
      return;
  }
};

const dispatchApproved = async (
  services: WorkerServices,
  approval: ApprovalRecord,
): Promise<void> => {
  const action = services.store.ledger.getAction(approval.actionId);
  if (action.status !== "PLANNED") {
    return;
  }
  const record = services.store.cases.getCase(approval.caseId);
  const verification = services.store.records.getVerification(approval.verificationId);
  const config = await services.reportdesk.readConfig(record.tenantId);
  const draft = await services.gmail.getDraftMime(approval.draftId);
  const contradictory = services.store.cases
    .getCaseResponse(record.id)
    .verifications.some(
      (candidate) =>
        candidate.result !== "PASS" &&
        new Date(candidate.verifiedAt).getTime() > new Date(verification.verifiedAt).getTime(),
    );
  const result = await services.actions.execute(
    intentFromAction(action),
    (planned) => {
      const decision = authorizeCustomerSend({
        caseRecord: services.store.cases.getCase(record.id),
        action: planned,
        approval: services.store.approvals.get(approval.id),
        verification,
        currentDraft: currentDraftFor(
          approval,
          draft,
          services.settings.providerAccountId,
          planned.payload,
        ),
        currentAppRevision: config.appRevision,
        currentConfigRevision: config.configRevision,
        allowedRecipients: allowedRecipients(services, record),
        contradictoryEvidence: contradictory,
        now: services.now(),
      });
      if (!decision.authorized) {
        return Promise.resolve(decision);
      }
      try {
        services.store.approvals.consume(approval.id);
      } catch (error: unknown) {
        if (error instanceof StatusError) {
          return Promise.resolve(denied("Approval was already used"));
        }
        throw error;
      }
      return Promise.resolve(decision);
    },
    async () => {
      const sent = await services.gmail.sendDraft({
        draftId: approval.draftId,
        threadId: approval.threadId,
        rawMime: approval.approvedMime,
      });
      return { providerIds: [sent.id] };
    },
  );
  settleCase(services, services.store.approvals.get(approval.id), result);
};

const handleRejected = (services: WorkerServices, approval: ApprovalRecord): void => {
  services.store.approvals.revoke(approval.id);
  const action = services.store.ledger.getAction(approval.actionId);
  if (action.status === "PLANNED") {
    services.store.ledger.reject(
      action.id,
      `Approver ${approval.approverId ?? "unknown"} rejected the message`,
    );
  }
  const record = services.store.cases.getCase(approval.caseId);
  if (record.state === "READY_FOR_APPROVAL") {
    requireHuman(
      services,
      record.id,
      "The approver rejected the proposed customer message.",
      "WAITING_ENGINEERING",
    );
  }
};

const handleExpired = (services: WorkerServices, approval: ApprovalRecord): void => {
  services.store.approvals.revoke(approval.id);
  const record = services.store.cases.getCase(approval.caseId);
  if (record.state === "READY_FOR_APPROVAL") {
    requireHuman(
      services,
      record.id,
      "The approval request expired. Recheck the workflow to request a fresh approval.",
      "WAITING_ENGINEERING",
    );
  }
};

export const processApprovals = async (services: WorkerServices): Promise<void> => {
  for (const approval of services.store.approvals.listExpiredPending()) {
    handleExpired(services, approval);
  }
  for (const approval of services.store.approvals.listAwaitingDispatch()) {
    try {
      if (approval.decision === "REJECTED") {
        handleRejected(services, approval);
      } else {
        await dispatchApproved(services, approval);
      }
    } catch (error: unknown) {
      console.error(`Approval ${approval.id} could not be processed: ${describeError(error)}`);
    }
  }
};
