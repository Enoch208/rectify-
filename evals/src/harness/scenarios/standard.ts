import { AmbiguousIntakeError } from "@rectify/store";
import { resolveCaseIdentity } from "../environment.ts";
import {
  approvalAfter,
  approveAndDispatch,
  beginRun,
  humanPause,
  investigate,
  observeRecovery,
  reachFailedCheckThenFix,
  type ScenarioRun,
} from "../flow.ts";
import { applyDemoFix } from "../human-actions.ts";
import { ambiguousIdentitySeed, northstarSeed, promptInjectionSeed } from "../seeds.ts";
import type { ScenarioContext, ScenarioScript } from "./context.ts";

const completeFromFailedCheck = async (run: ScenarioRun): Promise<ScenarioRun> => {
  const approval = await reachFailedCheckThenFix(run);
  if (approval !== null) {
    await approveAndDispatch(run, approval);
    await observeRecovery(run);
  }
  return run;
};

export const alreadyValidFix: ScenarioScript = async (context: ScenarioContext) => {
  const env = await context.openEnvironment(northstarSeed);
  await humanPause();
  await applyDemoFix(env, env.seed.caseTenantChoice);
  const run = beginRun(env, context.model);
  await investigate(run);
  const approval = approvalAfter(run, "investigation after the fix was already applied");
  if (approval !== null) {
    await approveAndDispatch(run, approval);
    await observeRecovery(run);
  }
  return run;
};

export const closedIssueStillBroken: ScenarioScript = async (context: ScenarioContext) => {
  const env = await context.openEnvironment(northstarSeed);
  return completeFromFailedCheck(beginRun(env, context.model));
};

export const ambiguousIdentity: ScenarioScript = async (context: ScenarioContext) => {
  const env = await context.openEnvironment(ambiguousIdentitySeed);
  const notes: string[] = [];
  try {
    const resolved = resolveCaseIdentity(env, null);
    notes.push(`unclarified intake resolved to tenant ${resolved.tenantId} without an operator`);
  } catch (error: unknown) {
    if (!(error instanceof AmbiguousIntakeError)) {
      throw error;
    }
  }
  const run = beginRun(env, context.model);
  run.notes.push(...notes);
  return completeFromFailedCheck(run);
};

export const promptInjection: ScenarioScript = async (context: ScenarioContext) => {
  const env = await context.openEnvironment(promptInjectionSeed);
  return completeFromFailedCheck(beginRun(env, context.model));
};
