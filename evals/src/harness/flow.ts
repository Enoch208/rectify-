import { setTimeout as delay } from "node:timers/promises";
import type { ActionRecord, ApprovalRecord, CaseRecord, CaseState } from "@rectify/core";
import type { GmailAdapter } from "@rectify/providers";
import type { EvaluationArtifact } from "../schema.ts";
import { startCaseWorker, type CaseWorker } from "./case-worker.ts";
import {
  harnessIdentity,
  resolveCaseIdentity,
  type HarnessModel,
  type ScenarioEnvironment,
} from "./environment.ts";
import { applyDemoFix, exportAsCustomer } from "./human-actions.ts";
import { deliverApprovalCallback, type ApprovalCallback } from "./slack-callback.ts";

const HUMAN_REACTION_MS = 20;

export const humanPause = (): Promise<void> => delay(HUMAN_REACTION_MS);

export interface ScenarioRun {
  readonly env: ScenarioEnvironment;
  worker: CaseWorker;
  readonly notes: string[];
  readonly callbacks: ApprovalCallback[];
  readonly reconciliations: EvaluationArtifact["reconciliations"];
}

export const beginRun = (
  env: ScenarioEnvironment,
  model: HarnessModel,
  gmail: GmailAdapter = env.gmail,
): ScenarioRun => ({
  env,
  worker: startCaseWorker(env, resolveCaseIdentity(env, env.seed.caseTenantChoice), model, gmail),
  notes: [],
  callbacks: [],
  reconciliations: [],
});

export const caseOf = (run: ScenarioRun): CaseRecord =>
  run.env.store.cases.getCase(run.worker.caseId);

export const expectState = (run: ScenarioRun, step: string, states: readonly CaseState[]) => {
  const record = caseOf(run);
  if (states.includes(record.state)) {
    return true;
  }
  run.notes.push(
    `${step}: expected ${states.join(" or ")} but case is ${record.state}${record.needsHumanReason === null ? "" : ` (${record.needsHumanReason})`}`,
  );
  return false;
};

export const runUntil = async (
  run: ScenarioRun,
  done: (record: CaseRecord) => boolean,
  maxPasses = 3,
): Promise<void> => {
  for (let pass = 0; pass < maxPasses && !done(caseOf(run)); pass += 1) {
    await run.worker.loop.runOnce();
  }
};

export const investigate = async (run: ScenarioRun): Promise<void> => {
  run.env.store.cases.queue(run.worker.caseId, "INVESTIGATE");
  await run.worker.loop.runOnce();
};

export const recheck = async (run: ScenarioRun): Promise<void> => {
  run.env.store.cases.queue(run.worker.caseId, "RECHECK");
  await run.worker.loop.runOnce();
};

export const humanFix = async (run: ScenarioRun): Promise<void> => {
  await humanPause();
  await applyDemoFix(run.env, caseOf(run).tenantId);
};

export const pendingApproval = (run: ScenarioRun): ApprovalRecord | null =>
  run.env.store.approvals
    .listForCase(run.worker.caseId)
    .filter((approval) => approval.decision === "PENDING" && approval.revokedAt === null)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .at(-1) ?? null;

export const sendCallback = async (
  run: ScenarioRun,
  approvalId: string,
): Promise<ApprovalCallback> => {
  await humanPause();
  const callback = deliverApprovalCallback(run.env, {
    approvalId,
    decision: "APPROVED",
    slackUserId: harnessIdentity.approverId,
  });
  run.callbacks.push(callback);
  return callback;
};

export const sendActionFor = (run: ScenarioRun, approval: ApprovalRecord): ActionRecord =>
  run.env.store.ledger.getAction(approval.actionId);

export const reachFailedCheckThenFix = async (run: ScenarioRun): Promise<ApprovalRecord | null> => {
  await investigate(run);
  if (!expectState(run, "investigation", ["WAITING_ENGINEERING"])) {
    return null;
  }
  await humanFix(run);
  await recheck(run);
  return approvalAfter(run, "recheck after human fix");
};

export const approvalAfter = (run: ScenarioRun, step: string): ApprovalRecord | null => {
  if (!expectState(run, step, ["READY_FOR_APPROVAL"])) {
    return null;
  }
  const approval = pendingApproval(run);
  if (approval === null) {
    run.notes.push(`${step}: case is READY_FOR_APPROVAL but no pending approval exists`);
  }
  return approval;
};

export const approveAndDispatch = async (
  run: ScenarioRun,
  approval: ApprovalRecord,
): Promise<ApprovalCallback> => {
  const callback = await sendCallback(run, approval.id);
  if (!callback.accepted) {
    run.notes.push(
      `approval ${approval.id}: callback rejected as ${String(callback.rejectionKind)}`,
    );
    return callback;
  }
  await runUntil(run, () => sendActionFor(run, approval).status !== "PLANNED", 2);
  return callback;
};

export const observeRecovery = async (run: ScenarioRun): Promise<void> => {
  if (!expectState(run, "customer send", ["WAITING_CUSTOMER"])) {
    return;
  }
  await humanPause();
  const exported = await exportAsCustomer(run.env, run.worker.caseId);
  if (exported.httpStatus !== 200 || exported.delivery !== "delivered") {
    run.notes.push(
      `customer export: HTTP ${String(exported.httpStatus)}, outcome delivery ${exported.delivery ?? "missing"}`,
    );
  }
  if (!expectState(run, "customer outcome", ["RECOVERED"])) {
    return;
  }
  await runUntil(run, (record) => record.syncState === "COMPLETE");
  const record = caseOf(run);
  if (record.syncState !== "COMPLETE") {
    run.notes.push(`recovery sync: expected COMPLETE but sync state is ${record.syncState}`);
  }
};
