import type { ApprovalRecord } from "@rectify/core";
import { restartCaseWorker } from "../case-worker.ts";
import {
  approveAndDispatch,
  beginRun,
  expectState,
  observeRecovery,
  reachFailedCheckThenFix,
  sendActionFor,
  type ScenarioRun,
} from "../flow.ts";
import { withLostSendResponse } from "../gmail-faults.ts";
import { northstarSeed } from "../seeds.ts";
import type { ScenarioContext, ScenarioScript } from "./context.ts";

const UNRESOLVABLE_PASSES = 3;

const sendHeldUnknown = async (run: ScenarioRun, label: string): Promise<ApprovalRecord | null> => {
  const approval = await reachFailedCheckThenFix(run);
  if (approval === null) {
    return null;
  }
  await approveAndDispatch(run, approval);
  const status = sendActionFor(run, approval).status;
  if (status !== "OUTCOME_UNKNOWN") {
    run.notes.push(`${label}: expected the lost send to be OUTCOME_UNKNOWN but it is ${status}`);
    return null;
  }
  expectState(run, `${label} lost send`, ["NEEDS_HUMAN"]);
  return approval;
};

const reconcilableBranch = async (context: ScenarioContext): Promise<ScenarioRun> => {
  const env = await context.openEnvironment(northstarSeed);
  const run = beginRun(
    env,
    context.model,
    withLostSendResponse(env.gmail, "response-lost-after-send"),
  );
  const approval = await sendHeldUnknown(run, "reconcilable branch");
  if (approval === null) {
    return run;
  }
  run.worker = await restartCaseWorker(env, run.worker, env.gmail);
  const sent = env.gmail.listSentMessages().length;
  const status = sendActionFor(run, approval).status;
  if (sent > 1) {
    run.reconciliations.push({ branch: "RECONCILABLE", result: "RESENT" });
  } else if (sent === 1 && status === "CONFIRMED") {
    run.reconciliations.push({ branch: "RECONCILABLE", result: "CONFIRMED_ORIGINAL" });
  } else if (status === "OUTCOME_UNKNOWN") {
    run.reconciliations.push({ branch: "RECONCILABLE", result: "HELD_UNKNOWN" });
  } else {
    run.notes.push(`reconcilable branch: send is ${status} with ${String(sent)} sent messages`);
  }
  await observeRecovery(run);
  if (sent <= 1 && env.gmail.listSentMessages().length > 1) {
    run.reconciliations.push({ branch: "RECONCILABLE", result: "RESENT" });
  }
  return run;
};

const unresolvableBranch = async (context: ScenarioContext, main: ScenarioRun): Promise<void> => {
  const env = await context.openEnvironment(northstarSeed);
  const run = beginRun(env, context.model, withLostSendResponse(env.gmail, "failed-before-send"));
  const approval = await sendHeldUnknown(run, "unresolvable branch");
  if (approval !== null) {
    run.worker = await restartCaseWorker(env, run.worker, env.gmail);
    for (let pass = 0; pass < UNRESOLVABLE_PASSES; pass += 1) {
      await run.worker.loop.runOnce();
    }
    const sent = env.gmail.listSentMessages().length;
    const status = sendActionFor(run, approval).status;
    if (sent > 0) {
      main.reconciliations.push({ branch: "UNRESOLVABLE", result: "RESENT" });
    } else if (status === "OUTCOME_UNKNOWN") {
      main.reconciliations.push({ branch: "UNRESOLVABLE", result: "HELD_UNKNOWN" });
    } else {
      run.notes.push(`unresolvable branch: send is ${status} with no sent message`);
    }
  }
  main.notes.push(...run.notes);
};

export const lostResponseAndRestart: ScenarioScript = async (context: ScenarioContext) => {
  const main = await reconcilableBranch(context);
  await unresolvableBranch(context, main);
  return main;
};
