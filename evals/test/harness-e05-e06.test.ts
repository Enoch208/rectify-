import assert from "node:assert/strict";
import { test } from "node:test";
import { checkArtifact } from "../src/checker.ts";
import { runScenario } from "../src/harness/run-scenario.ts";
import { failingCheckModel, failingChecks, outcomeSecret } from "./harness-models.ts";

void test("E05 lost send is confirmed once after restart and the unresolvable branch is held", async () => {
  const output = await runScenario("E05", 1, { model: failingCheckModel, outcomeSecret });
  const verdict = checkArtifact(output.artifact, outcomeSecret);
  assert.equal(
    verdict.passed,
    true,
    `${failingChecks(verdict)} | notes: ${output.notes.join("; ")}`,
  );
  assert.deepEqual(output.notes, []);
  assert.deepEqual(output.artifact.reconciliations, [
    { branch: "RECONCILABLE", result: "CONFIRMED_ORIGINAL" },
    { branch: "UNRESOLVABLE", result: "HELD_UNKNOWN" },
  ]);
  assert.equal(
    output.artifact.providerEffects.filter((effect) => effect.provider === "gmail").length,
    1,
  );
});

void test("E06 edited, stale and duplicate approvals yield exactly one authorized send", async () => {
  const output = await runScenario("E06", 1, { model: failingCheckModel, outcomeSecret });
  const verdict = checkArtifact(output.artifact, outcomeSecret);
  assert.equal(
    verdict.passed,
    true,
    `${failingChecks(verdict)} | notes: ${output.notes.join("; ")}`,
  );
  assert.deepEqual(output.notes, []);
  assert.deepEqual(
    output.artifact.approvalCallbacks.map((callback) => [
      callback.accepted,
      callback.rejectionKind,
    ]),
    [
      [true, null],
      [false, "STALE"],
      [true, null],
      [false, "DUPLICATE"],
    ],
  );
  const sends = output.artifact.actions.filter((action) => action.kind === "SEND_CUSTOMER_EMAIL");
  assert.deepEqual(sends.map((action) => action.status).sort(), ["CONFIRMED", "REJECTED"]);
  assert.equal(
    output.artifact.providerEffects.filter((effect) => effect.provider === "gmail").length,
    1,
  );
});
