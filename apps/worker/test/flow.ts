import assert from "node:assert/strict";
import type { ApprovalRecord } from "@rectify/core";
import type { FixtureGmailAdapter, GmailAdapter, GmailMessageRef } from "@rectify/providers";
import { secrets, type createPipeline } from "./pipeline-harness.ts";

type Pipeline = Awaited<ReturnType<typeof createPipeline>>;

export const reachPendingApproval = async (pipeline: Pipeline): Promise<ApprovalRecord> => {
  pipeline.store.cases.queue(pipeline.caseId, "INVESTIGATE");
  await pipeline.loop.runOnce();
  assert.equal(pipeline.store.cases.getCase(pipeline.caseId).state, "WAITING_ENGINEERING");
  const fix = await pipeline.post("/api/demo/fix", secrets.operator, { tenantId: "northstar" });
  assert.equal(fix.status, 200);
  pipeline.store.cases.queue(pipeline.caseId, "RECHECK");
  await pipeline.loop.runOnce();
  const record = pipeline.store.cases.getCase(pipeline.caseId);
  assert.equal(record.state, "READY_FOR_APPROVAL", record.needsHumanReason ?? "");
  const approval = pipeline.store.approvals.listForCase(pipeline.caseId)[0];
  assert.ok(approval);
  return approval;
};

export const approve = (pipeline: Pipeline, approval: ApprovalRecord): void => {
  pipeline.store.approvals.save({ ...approval, decision: "APPROVED", approverId: "U-APPROVER" });
};

type SendBehaviour = "lose-response-after-send" | "fail-before-send";

export const flakySend =
  (behaviour: SendBehaviour) =>
  (gmail: FixtureGmailAdapter): GmailAdapter => ({
    mode: gmail.mode,
    readThread: (threadId) => gmail.readThread(threadId),
    createDraft: (input) => gmail.createDraft(input),
    getDraftMime: (draftId) => gmail.getDraftMime(draftId),
    listDrafts: () => gmail.listDrafts(),
    findMessagesByRfc822MessageId: (id) => gmail.findMessagesByRfc822MessageId(id),
    sendDraft: async (input): Promise<GmailMessageRef> => {
      if (behaviour === "lose-response-after-send") {
        await gmail.sendDraft(input);
      }
      throw new Error("socket hang up");
    },
  });

export const editedDraft = (gmail: FixtureGmailAdapter): GmailAdapter => ({
  mode: gmail.mode,
  readThread: (threadId) => gmail.readThread(threadId),
  createDraft: (input) => gmail.createDraft(input),
  listDrafts: () => gmail.listDrafts(),
  findMessagesByRfc822MessageId: (id) => gmail.findMessagesByRfc822MessageId(id),
  sendDraft: (input) => gmail.sendDraft(input),
  getDraftMime: async (draftId) => {
    const draft = await gmail.getDraftMime(draftId);
    return { ...draft, rawMime: `${draft.rawMime}\r\nP.S. Your refund of $500 has been approved.` };
  },
});
