import assert from "node:assert/strict";
import { test } from "node:test";
import { createPipeline, secrets } from "./pipeline-harness.ts";
import { northstarInvestigation } from "./scripted-model.ts";

void test("closed issue, failing export, human fix, approved send and observed recovery", async () => {
  const pipeline = await createPipeline(northstarInvestigation);
  const { store, caseId, loop } = pipeline;
  try {
    store.cases.queue(caseId, "INVESTIGATE");
    await loop.runOnce();
    let record = store.cases.getCase(caseId);
    assert.equal(record.state, "WAITING_ENGINEERING", record.needsHumanReason ?? "");
    assert.equal(record.matchedEngineeringIssueId, "41");
    assert.equal(record.engineeringState, "CLOSED");
    let data = store.cases.getCaseResponse(caseId);
    assert.equal(data.verifications.at(-1)?.result, "FAIL");
    assert.deepEqual(
      new Set(data.evidence.map((item) => item.provider)),
      new Set(["gmail", "github", "slack"]),
    );
    const confirmedKinds = data.actions
      .filter((action) => action.status === "CONFIRMED")
      .map((action) => action.kind);
    assert.deepEqual(confirmedKinds.sort(), ["CREATE_IMPACT_ISSUE", "POST_SLACK_HANDOFF"]);
    assert.equal(pipeline.gmail.listSentMessages().length, 0);

    const fix = await pipeline.post("/api/demo/fix", secrets.operator, { tenantId: "northstar" });
    assert.equal(fix.status, 200);
    store.cases.queue(caseId, "RECHECK");
    await loop.runOnce();
    record = store.cases.getCase(caseId);
    assert.equal(record.state, "READY_FOR_APPROVAL", record.needsHumanReason ?? "");
    assert.equal(record.notificationState, "AWAITING_APPROVAL");
    const [approval] = store.approvals.listForCase(caseId);
    assert.ok(approval);
    assert.equal(approval.decision, "PENDING");
    assert.deepEqual(approval.recipients, ["maya@northstar.example"]);

    store.approvals.save({ ...approval, decision: "APPROVED", approverId: "U-APPROVER" });
    await loop.runOnce();
    await loop.runOnce();
    record = store.cases.getCase(caseId);
    assert.equal(record.state, "WAITING_CUSTOMER", record.needsHumanReason ?? "");
    assert.equal(record.notificationState, "SENT");
    assert.equal(pipeline.gmail.listSentMessages().length, 1);
    assert.notEqual(store.approvals.get(approval.id).consumedAt, null);

    const exported = await pipeline.post("/api/customer/export", secrets.customer, {
      caseId,
      period: "2026-08",
    });
    assert.equal(exported.status, 200);
    assert.equal(exported.headers.get("x-outcome-delivery"), "delivered");
    record = store.cases.getCase(caseId);
    assert.equal(record.state, "RECOVERED");
    assert.equal(record.syncState, "PENDING");

    await loop.runOnce();
    record = store.cases.getCase(caseId);
    assert.equal(record.syncState, "COMPLETE");
    data = store.cases.getCaseResponse(caseId);
    const syncKinds = data.actions
      .filter((action) => action.kind.includes("RECOVERY"))
      .map((action) => action.status);
    assert.deepEqual(syncKinds, ["CONFIRMED", "CONFIRMED"]);
    assert.equal(pipeline.github.listAllComments().length, 1);
    assert.equal(pipeline.gmail.listSentMessages().length, 1);
  } finally {
    await pipeline.close();
  }
});
