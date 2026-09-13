import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { signOutcomeEvent } from "@rectify/core/outcomes";
import { openStore } from "@rectify/store";
import { HttpError, errorResponse } from "./errors.ts";
import { acceptCustomerOutcome } from "./outcome-events.ts";
import { bindSlackDecision, parseSlackDecision, verifySlackRequest } from "@rectify/store";
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
    const store = openStore({ path, now: () => now, createId: () => "case-1" });
    try {
      const created = store.cases.createOrResume(identity, environments);
      store.records.saveVerification(passingVerification(created.id));
      store.records.saveCase(waitingCustomerCase(created));
      const event = signOutcomeEvent(unsignedOutcome(created.id), "secret");
      assert.throws(
        () =>
          acceptCustomerOutcome(
            signOutcomeEvent({ ...unsignedOutcome(created.id), tenantId: "other" }, "secret"),
            "secret",
            store,
            now,
          ),
        HttpError,
      );
      assert.throws(
        () =>
          acceptCustomerOutcome(
            signOutcomeEvent({ ...unsignedOutcome(created.id), actorType: "PROBE" }, "secret"),
            "secret",
            store,
            now,
          ),
        HttpError,
      );
      assert.throws(
        () =>
          acceptCustomerOutcome(
            signOutcomeEvent({ ...unsignedOutcome(created.id), configRevision: 3 }, "secret"),
            "secret",
            store,
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
            store,
            now,
          ),
        HttpError,
      );
      acceptCustomerOutcome(event, "secret", store, now);
      assert.equal(store.cases.getCase(created.id).recoveryState, "OBSERVED");
      assert.equal(store.cases.getCase(created.id).syncState, "PENDING");
      assert.throws(() => acceptCustomerOutcome(event, "secret", store, now), HttpError);
    } finally {
      store.close();
    }
  });
});

void test("unknown resources become JSON 404 responses", async () => {
  const response = errorResponse(new HttpError(404, "Run not found: missing"));
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
  assert.deepEqual(await response.json(), { error: "Run not found: missing" });
});

void test("approval persistence retains the bound decision", () => {
  withDatabase((path) => {
    const store = openStore({ path, now: () => now, createId: () => "case-1" });
    try {
      store.cases.createOrResume(identity, environments);
      store.approvals.save(approval);
      assert.equal(store.approvals.get(approval.id).nonce, approval.nonce);
      store.approvals.consume(approval.id);
      assert.throws(() => store.approvals.consume(approval.id), HttpError);
    } finally {
      store.close();
    }
  });
});
