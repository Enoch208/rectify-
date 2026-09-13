import assert from "node:assert/strict";
import { test } from "node:test";
import { ActionWorker, createReconcilers, WorkerLoop } from "../src/index.ts";
import { approve, editedDraft, flakySend, reachPendingApproval } from "./flow.ts";
import { createPipeline } from "./pipeline-harness.ts";
import { northstarInvestigation } from "./scripted-model.ts";

type Pipeline = Awaited<ReturnType<typeof createPipeline>>;

const restartWithHealthyGmail = async (pipeline: Pipeline): Promise<WorkerLoop> => {
  const services = {
    ...pipeline.services,
    gmail: pipeline.gmail,
    actions: new ActionWorker({
      ledger: pipeline.store.ledger,
      reconcilers: createReconcilers({
        gmail: pipeline.gmail,
        github: pipeline.github,
        slack: pipeline.slack,
      }),
    }),
  };
  const loop = new WorkerLoop(services, {
    pollMs: 1_000,
    reconcileEveryMs: 60_000,
    maxJobAttempts: 3,
  });
  await loop.reconcile();
  return loop;
};

const sendAction = (pipeline: Pipeline) =>
  pipeline.store.cases
    .getCaseResponse(pipeline.caseId)
    .actions.find((action) => action.kind === "SEND_CUSTOMER_EMAIL");

void test("a send whose response is lost is reconciled after restart and never resent", async () => {
  const pipeline = await createPipeline(northstarInvestigation, {
    wrapGmail: flakySend("lose-response-after-send"),
  });
  try {
    approve(pipeline, await reachPendingApproval(pipeline));
    await pipeline.loop.runOnce();
    assert.equal(sendAction(pipeline)?.status, "OUTCOME_UNKNOWN");
    const held = pipeline.store.cases.getCase(pipeline.caseId);
    assert.equal(held.state, "NEEDS_HUMAN");
    assert.equal(held.notificationState, "OUTCOME_UNKNOWN");
    const restarted = await restartWithHealthyGmail(pipeline);
    assert.equal(sendAction(pipeline)?.status, "CONFIRMED");
    const record = pipeline.store.cases.getCase(pipeline.caseId);
    assert.equal(record.state, "WAITING_CUSTOMER");
    assert.equal(record.notificationState, "SENT");
    await restarted.runOnce();
    await restarted.runOnce();
    assert.equal(pipeline.gmail.listSentMessages().length, 1);
  } finally {
    await pipeline.close();
  }
});

void test("an unresolvable lost send is held as unknown without any resend", async () => {
  const pipeline = await createPipeline(northstarInvestigation, {
    wrapGmail: flakySend("fail-before-send"),
  });
  try {
    approve(pipeline, await reachPendingApproval(pipeline));
    await pipeline.loop.runOnce();
    const restarted = await restartWithHealthyGmail(pipeline);
    await restarted.runOnce();
    await restarted.runOnce();
    const action = sendAction(pipeline);
    assert.equal(action?.status, "OUTCOME_UNKNOWN");
    assert.match(action.uncertaintyReason ?? "", /absence is not proof/u);
    assert.equal(pipeline.store.cases.getCase(pipeline.caseId).state, "NEEDS_HUMAN");
    assert.equal(pipeline.gmail.listSentMessages().length, 0);
  } finally {
    await pipeline.close();
  }
});

void test("a draft edited after the approval request is blocked by the send policy", async () => {
  const pipeline = await createPipeline(northstarInvestigation, { wrapGmail: editedDraft });
  try {
    const approval = await reachPendingApproval(pipeline);
    approve(pipeline, approval);
    await pipeline.loop.runOnce();
    assert.equal(sendAction(pipeline)?.status, "REJECTED");
    assert.match(sendAction(pipeline)?.error ?? "", /changed/u);
    assert.notEqual(pipeline.store.approvals.get(approval.id).revokedAt, null);
    const record = pipeline.store.cases.getCase(pipeline.caseId);
    assert.equal(record.state, "NEEDS_HUMAN");
    assert.equal(pipeline.gmail.listSentMessages().length, 0);
  } finally {
    await pipeline.close();
  }
});

void test("an approval that expires before a decision sends nothing and asks for a recheck", async () => {
  const pipeline = await createPipeline(northstarInvestigation);
  try {
    const approval = await reachPendingApproval(pipeline);
    pipeline.store.approvals.save({
      ...approval,
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
    });
    await pipeline.loop.runOnce();
    const record = pipeline.store.cases.getCase(pipeline.caseId);
    assert.equal(record.state, "NEEDS_HUMAN");
    assert.match(record.needsHumanReason ?? "", /expired/u);
    assert.equal(pipeline.gmail.listSentMessages().length, 0);
  } finally {
    await pipeline.close();
  }
});

void test("without model configuration the investigation stops for a human instead of guessing", async () => {
  const pipeline = await createPipeline(northstarInvestigation, { withoutModel: true });
  try {
    pipeline.store.cases.queue(pipeline.caseId, "INVESTIGATE");
    await pipeline.loop.runOnce();
    const record = pipeline.store.cases.getCase(pipeline.caseId);
    assert.equal(record.state, "NEEDS_HUMAN");
    assert.equal(record.resumeState, "NEW");
    assert.equal(pipeline.store.runs.list()[0]?.status, "STOPPED");
    assert.equal(pipeline.store.cases.getCaseResponse(pipeline.caseId).actions.length, 0);
  } finally {
    await pipeline.close();
  }
});
