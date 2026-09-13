import assert from "node:assert/strict";
import { test } from "node:test";
import {
  actionRecordSchema,
  approvalRecordSchema,
  caseRecordSchema,
  verificationRecordSchema,
} from "../src/index.ts";
import { authorizeCustomerSend, type SendPolicyInput } from "../src/send-policy.ts";
import { actionRecord, approvalRecord, caseRecord, verificationRecord } from "./fixtures.ts";

const validInput = (): SendPolicyInput => {
  const action = actionRecordSchema.parse({
    ...actionRecord,
    provider: "gmail",
    kind: "send-customer-email",
  });
  const approval = approvalRecordSchema.parse({
    ...approvalRecord,
    actionId: action.id,
    actionHash: action.payloadHash,
    decision: "APPROVED",
  });
  const verification = verificationRecordSchema.parse({
    ...verificationRecord,
    result: "PASS",
    observed: {
      ...verificationRecord.observed,
      rows: [...verificationRecord.expected.rows],
      failureReason: null,
    },
  });
  return {
    caseRecord: caseRecordSchema.parse({
      ...caseRecord,
      state: "READY_FOR_APPROVAL",
      version: approval.caseVersion,
    }),
    action,
    approval,
    verification,
    currentDraft: {
      providerAccountId: approval.providerAccountId,
      draftId: approval.draftId,
      threadId: approval.threadId,
      sender: approval.sender,
      recipients: approval.recipients,
      subject: approval.subject,
      body: approval.body,
      approvedMime: approval.approvedMime,
      businessFieldsHash: approval.businessFieldsHash,
    },
    currentAppRevision: approval.appRevision,
    currentConfigRevision: approval.configRevision,
    allowedRecipients: new Set(approval.recipients),
    contradictoryEvidence: false,
    now: new Date("2026-09-13T12:03:00.000Z"),
  };
};

void test("an unchanged approved payload with fresh evidence is authorized", () => {
  assert.deepEqual(authorizeCustomerSend(validInput()), { authorized: true });
});

void test("a configuration change invalidates approval before dispatch", () => {
  const input = validInput();
  const decision = authorizeCustomerSend({ ...input, currentConfigRevision: 2 });
  assert.deepEqual(decision, {
    authorized: false,
    reason: "Application configuration changed",
  });
});

void test("recipient, draft and freshness changes are rejected", () => {
  const input = validInput();
  assert.equal(authorizeCustomerSend({ ...input, allowedRecipients: new Set() }).authorized, false);
  assert.equal(
    authorizeCustomerSend({
      ...input,
      currentDraft: { ...input.currentDraft, body: "Edited after approval" },
    }).authorized,
    false,
  );
  assert.equal(
    authorizeCustomerSend({ ...input, now: new Date("2026-09-13T12:05:00.000Z") }).authorized,
    false,
  );
});
