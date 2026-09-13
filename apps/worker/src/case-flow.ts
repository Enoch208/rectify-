import type { ActionRecord, CaseRecord, CaseState, VerificationRecord } from "@rectify/core";
import type { ActionIntent } from "@rectify/core/ledger";
import type { CasePatch } from "@rectify/store";
import type { WorkerServices } from "./services.ts";
import type { ActionAuthorizer, ActionExecutor } from "./worker.ts";

export type ResumeState = Exclude<CaseState, "RECOVERED" | "NEEDS_HUMAN">;

export const moveCase = (
  services: WorkerServices,
  caseId: string,
  patch: CasePatch,
): CaseRecord => {
  const current = services.store.cases.getCase(caseId);
  return services.store.cases.updateCase(caseId, current.version, patch);
};

export const requireHuman = (
  services: WorkerServices,
  caseId: string,
  reason: string,
  resumeState: ResumeState,
): CaseRecord =>
  moveCase(services, caseId, {
    state: "NEEDS_HUMAN",
    needsHumanReason: reason.slice(0, 1_000),
    resumeState,
  });

export const latestVerification = (
  services: WorkerServices,
  record: CaseRecord,
): VerificationRecord | null =>
  record.latestVerificationId === null
    ? null
    : services.store.records.getVerification(record.latestVerificationId);

export const intentFromAction = (action: ActionRecord): ActionIntent => ({
  caseId: action.caseId,
  logicalKey: action.logicalKey,
  provider: action.provider,
  kind: action.kind,
  payload: action.payload,
});

export const executeOnce = async (
  services: WorkerServices,
  intent: () => ActionIntent,
  authorize: ActionAuthorizer,
  execute: ActionExecutor,
  logicalKey: string,
): Promise<ActionRecord> => {
  const existing = services.store.ledger.getByLogicalKey(logicalKey);
  if (existing !== null && existing.status !== "PLANNED") {
    return existing;
  }
  return services.actions.execute(
    existing === null ? intent() : intentFromAction(existing),
    authorize,
    execute,
  );
};

export const allowed = { authorized: true } as const;

export const denied = (reason: string) => ({ authorized: false, reason }) as const;

export const payloadString = (action: ActionRecord, field: string): string => {
  const value = action.payload[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Action ${action.id} payload is missing ${field}`);
  }
  return value;
};

export const payloadNumber = (action: ActionRecord, field: string): number => {
  const value = action.payload[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`Action ${action.id} payload is missing ${field}`);
  }
  return value;
};

export const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown worker failure";
