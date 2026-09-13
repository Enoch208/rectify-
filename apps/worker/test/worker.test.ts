import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ActionLedger } from "@rectify/core/ledger";
import { ActionWorker } from "../src/index.ts";

const createFixture = () => {
  const directory = mkdtempSync(join(tmpdir(), "rectify-worker-"));
  const path = join(directory, "actions.sqlite");
  const ledger = new ActionLedger({ path });
  return { ledger, path, directory };
};

const intent = {
  caseId: "case-1",
  logicalKey: "case-1:slack:handoff",
  provider: "slack",
  kind: "post-handoff",
  payload: { channelId: "C123", text: "Northstar export remains empty" },
} as const;

void test("worker persists dispatch intent before invoking a provider write", async () => {
  const fixture = createFixture();
  try {
    const worker = new ActionWorker({ ledger: fixture.ledger });
    const result = await worker.execute(
      intent,
      () => Promise.resolve({ authorized: true }),
      (action) => {
        assert.equal(fixture.ledger.getAction(action.id).status, "DISPATCHING");
        return Promise.resolve({ providerIds: ["message-1"] });
      },
    );

    assert.equal(result.status, "CONFIRMED");
    assert.deepEqual(result.providerIds, ["message-1"]);
  } finally {
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true });
  }
});

void test("ambiguous provider failure is held and a duplicate trigger cannot resend", async () => {
  const fixture = createFixture();
  let writes = 0;
  try {
    const worker = new ActionWorker({ ledger: fixture.ledger });
    const first = await worker.execute(
      intent,
      () => Promise.resolve({ authorized: true }),
      () => {
        writes += 1;
        return Promise.reject(new Error("Connection closed after dispatch"));
      },
    );
    const duplicate = await worker.execute(
      intent,
      () => Promise.resolve({ authorized: true }),
      () => {
        writes += 1;
        return Promise.resolve({ providerIds: ["message-2"] });
      },
    );

    assert.equal(first.status, "OUTCOME_UNKNOWN");
    assert.equal(duplicate.status, "OUTCOME_UNKNOWN");
    assert.equal(writes, 1);
  } finally {
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true });
  }
});

void test("restart reconciliation confirms the original effect without redispatch", async () => {
  const fixture = createFixture();
  const planned = fixture.ledger.planAction(intent);
  fixture.ledger.authorize(planned.id);
  fixture.ledger.startDispatch(planned.id);
  fixture.ledger.close();
  const reopened = new ActionLedger({ path: fixture.path });
  try {
    const worker = new ActionWorker({
      ledger: reopened,
      reconcilers: new Map([
        [
          "slack:post-handoff",
          () => Promise.resolve({ outcome: "CONFIRMED" as const, providerIds: ["message-1"] }),
        ],
      ]),
    });
    const results = await worker.reconcileOnRestart();

    assert.equal(results[0]?.status, "CONFIRMED");
    assert.deepEqual(results[0].providerIds, ["message-1"]);
    assert.equal(reopened.getAction(planned.id).attempts.length, 1);
  } finally {
    reopened.close();
    rmSync(fixture.directory, { recursive: true });
  }
});

void test("unresolved reconciliation remains outcome unknown for a human", async () => {
  const fixture = createFixture();
  try {
    const planned = fixture.ledger.planAction(intent);
    fixture.ledger.authorize(planned.id);
    fixture.ledger.startDispatch(planned.id);
    fixture.ledger.markOutcomeUnknown(planned.id, "Lost response");
    const worker = new ActionWorker({
      ledger: fixture.ledger,
      reconcilers: new Map([
        [
          "slack:post-handoff",
          () => Promise.resolve({ outcome: "UNRESOLVED" as const, reason: "No durable match" }),
        ],
      ]),
    });
    const results = await worker.reconcileOnRestart();

    assert.equal(results[0]?.status, "OUTCOME_UNKNOWN");
    assert.equal(results[0].uncertaintyReason, "No durable match");
  } finally {
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true });
  }
});
