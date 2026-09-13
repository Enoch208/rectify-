import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { signOutcomeEvent } from "@rectify/core/outcomes";
import { ApprovalRepository } from "./approval-repository.ts";
import { requireOperator } from "./auth.ts";
import { CaseRepository } from "./case-repository.ts";
import { HttpError, errorResponse } from "./errors.ts";
import { acceptCustomerOutcome } from "./outcome-events.ts";
import { RecordRepository } from "./record-repository.ts";
import { bindSlackDecision, parseSlackDecision, verifySlackRequest } from "./slack-approval.ts";
import {
  approval,
  environments,
  identity,
  now,
  passingVerification,
  unsignedOutcome,
  waitingCustomerCase,
} from "./server-test-fixtures.ts";

const withDatabase = <Output>(operation: (path: string) => Output): Output => {
  const directory = mkdtempSync(join(tmpdir(), "rectify-web-"));
  try {
    return operation(join(directory, "state.sqlite"));
  } finally {
    rmSync(directory, { recursive: true });
  }
};

void test("Slack approval binds signature, timestamp, approver, provenance, nonce and expiry", () => {
  const value = JSON.stringify({
    approvalId: approval.id,
    nonce: approval.nonce,
    decision: "APPROVED",
  });
  const payload = {
    type: "block_actions",
    team: { id: approval.slackWorkspaceId },
    user: { id: "approver-1" },
    channel: { id: approval.slackChannelId },
    message: { ts: approval.slackMessageId },
    actions: [{ action_id: "rectify_approval", value }],
  };
  const rawBody = new URLSearchParams({ payload: JSON.stringify(payload) }).toString();
  const timestamp = String(now.getTime() / 1_000);
  const signature = `v0=${createHmac("sha256", "secret")
    .update(`v0:${timestamp}:${rawBody}`)
    .digest("hex")}`;
  verifySlackRequest(rawBody, signature, timestamp, "secret", now);
  const parsed = parseSlackDecision(rawBody);
  const updated = bindSlackDecision(
    parsed.payload,
    parsed.decision,
    approval,
    new Set(["approver-1"]),
    now,
  );
  assert.equal(updated.decision, "APPROVED");
  assert.throws(
    () => bindSlackDecision(parsed.payload, parsed.decision, approval, new Set(["other"]), now),
    HttpError,
  );
  assert.throws(
    () =>
      bindSlackDecision(
        parsed.payload,
        parsed.decision,
        { ...approval, expiresAt: now.toISOString() },
        new Set(["approver-1"]),
        now,
      ),
    HttpError,
  );
  assert.throws(
    () => bindSlackDecision(parsed.payload, parsed.decision, updated, new Set(["approver-1"]), now),
    HttpError,
  );
  assert.throws(() => {
    verifySlackRequest(rawBody, signature, timestamp, "wrong", now);
  }, HttpError);
  assert.throws(() => {
    verifySlackRequest(rawBody, signature, timestamp, "secret", new Date(now.getTime() + 300_001));
  }, HttpError);
});

void test("only a fresh signed customer outcome matching a passing revision records recovery", () => {
  withDatabase((path) => {
    const cases = new CaseRepository({ path, now: () => now, createId: () => "case-1" });
    const records = new RecordRepository(path);
    try {
      const created = cases.createOrResume(identity, environments);
      records.saveVerification(passingVerification(created.id));
      records.saveCase(waitingCustomerCase(created));
      const event = signOutcomeEvent(unsignedOutcome(created.id), "secret");
      assert.throws(
        () =>
          acceptCustomerOutcome(
            signOutcomeEvent({ ...unsignedOutcome(created.id), tenantId: "other" }, "secret"),
            "secret",
            cases,
            now,
          ),
        HttpError,
      );
      assert.throws(
        () =>
          acceptCustomerOutcome(
            signOutcomeEvent({ ...unsignedOutcome(created.id), actorType: "PROBE" }, "secret"),
            "secret",
            cases,
            now,
          ),
        HttpError,
      );
      assert.throws(
        () =>
          acceptCustomerOutcome(
            signOutcomeEvent({ ...unsignedOutcome(created.id), configRevision: 3 }, "secret"),
            "secret",
            cases,
            now,
          ),
        HttpError,
      );
      const staleAt = new Date(now.getTime() - 300_001).toISOString();
      assert.throws(
        () =>
          acceptCustomerOutcome(
            signOutcomeEvent({ ...unsignedOutcome(created.id), occurredAt: staleAt }, "secret"),
            "secret",
            cases,
            now,
          ),
        HttpError,
      );
      acceptCustomerOutcome(event, "secret", cases, now);
      assert.equal(cases.getCase(created.id).recoveryState, "OBSERVED");
      assert.throws(() => acceptCustomerOutcome(event, "secret", cases, now), HttpError);
    } finally {
      records.close();
      cases.close();
    }
  });
});

void test("unknown resources become JSON 404 responses", async () => {
  const response = errorResponse(new HttpError(404, "Run not found: missing"));
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
  assert.deepEqual(await response.json(), { error: "Run not found: missing" });
});

void test("operator authentication accepts bearer and encoded same-origin cookie tokens", () => {
  requireOperator(
    new Request("https://rectify.example/api/cases", {
      headers: { authorization: "Bearer token with spaces" },
    }),
    "token with spaces",
  );
  requireOperator(
    new Request("https://rectify.example/api/cases", {
      headers: { cookie: "rectify_operator_token=token%20with%20spaces" },
    }),
    "token with spaces",
  );
  assert.throws(() => {
    requireOperator(
      new Request("https://rectify.example/api/cases", {
        headers: { cookie: "rectify_operator_token=wrong" },
      }),
      "token with spaces",
    );
  }, HttpError);
});

void test("approval persistence retains the bound decision", () => {
  withDatabase((path) => {
    const cases = new CaseRepository({ path, now: () => now, createId: () => "case-1" });
    const approvals = new ApprovalRepository(path);
    try {
      cases.createOrResume(identity, environments);
      approvals.save(approval);
      assert.equal(approvals.get(approval.id).nonce, approval.nonce);
    } finally {
      approvals.close();
      cases.close();
    }
  });
});
