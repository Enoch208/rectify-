import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ActionLedger, ActionTransitionError, LogicalActionConflictError } from "../src/ledger.ts";

const createLedger = () => {
  const directory = mkdtempSync(join(tmpdir(), "rectify-ledger-"));
  const path = join(directory, "actions.sqlite");
  let id = 0;
  const ledger = new ActionLedger({
    path,
    now: () => new Date("2026-09-13T12:00:00.000Z"),
    createId: () => `action-${String((id += 1))}`,
  });
  return { ledger, path, directory };
};

const intent = {
  caseId: "case-1",
  logicalKey: "case-1:github:impact",
  provider: "github",
  kind: "create-impact-issue",
  payload: { title: "Northstar export remains empty", nested: { revision: 1 } },
} as const;

void test("logical action keys deduplicate identical intent and reject changed payloads", () => {
  const fixture = createLedger();
  try {
    const first = fixture.ledger.planAction(intent);
    const duplicate = fixture.ledger.planAction({
      ...intent,
      payload: { nested: { revision: 1 }, title: "Northstar export remains empty" },
    });

    assert.equal(first.id, duplicate.id);
    assert.throws(
      () => fixture.ledger.planAction({ ...intent, payload: { title: "Different write" } }),
      LogicalActionConflictError,
    );
  } finally {
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true });
  }
});

void test("dispatch transitions persist attempts and reject blind redispatch", () => {
  const fixture = createLedger();
  try {
    const planned = fixture.ledger.planAction(intent);
    fixture.ledger.authorize(planned.id);
    const dispatching = fixture.ledger.startDispatch(planned.id);
    const uncertain = fixture.ledger.markOutcomeUnknown(planned.id, "Response lost");

    assert.equal(dispatching.attempts[0]?.outcome, null);
    assert.equal(uncertain.attempts[0]?.outcome, "OUTCOME_UNKNOWN");
    assert.throws(() => fixture.ledger.startDispatch(planned.id), ActionTransitionError);
  } finally {
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true });
  }
});

void test("a file-backed ledger preserves dispatch state across process restarts", () => {
  const fixture = createLedger();
  const planned = fixture.ledger.planAction(intent);
  fixture.ledger.authorize(planned.id);
  fixture.ledger.startDispatch(planned.id);
  fixture.ledger.close();
  const reopened = new ActionLedger({ path: fixture.path });
  try {
    const recovered = reopened.recoverInterruptedDispatches();

    assert.equal(recovered.length, 1);
    assert.equal(recovered[0]?.status, "OUTCOME_UNKNOWN");
    assert.equal(reopened.getAction(planned.id).attempts[0]?.outcome, "OUTCOME_UNKNOWN");
  } finally {
    reopened.close();
    rmSync(fixture.directory, { recursive: true });
  }
});
