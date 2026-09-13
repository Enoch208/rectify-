import {
  approvalAfter,
  approveAndDispatch,
  beginRun,
  expectState,
  observeRecovery,
  reachFailedCheckThenFix,
  recheck,
  sendActionFor,
  sendCallback,
} from "../flow.ts";
import { withEditedDrafts } from "../gmail-faults.ts";
import { northstarSeed } from "../seeds.ts";
import type { ScenarioContext, ScenarioScript } from "./context.ts";

export const duplicateAndEditedApproval: ScenarioScript = async (context: ScenarioContext) => {
  const env = await context.openEnvironment(northstarSeed);
  const editedDraftIds = new Set<string>();
  const run = beginRun(env, context.model, withEditedDrafts(env.gmail, editedDraftIds));
  const edited = await reachFailedCheckThenFix(run);
  if (edited === null) {
    return run;
  }
  editedDraftIds.add(edited.draftId);
  await approveAndDispatch(run, edited);
  const blocked = sendActionFor(run, edited).status;
  if (blocked !== "REJECTED") {
    run.notes.push(
      `edited draft: expected the send policy to reject it but the send is ${blocked}`,
    );
  }
  if (!expectState(run, "edited draft send", ["NEEDS_HUMAN"])) {
    return run;
  }
  await sendCallback(run, edited.id);
  await recheck(run);
  const fresh = approvalAfter(run, "recheck after the edited draft was blocked");
  if (fresh === null) {
    return run;
  }
  if (fresh.draftId === edited.draftId) {
    run.notes.push("recheck reused the edited draft instead of preparing a fresh one");
  }
  await approveAndDispatch(run, fresh);
  await sendCallback(run, fresh.id);
  await observeRecovery(run);
  return run;
};
