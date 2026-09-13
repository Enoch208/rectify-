import assert from "node:assert/strict";
import { test } from "node:test";
import { checkArtifact } from "../src/checker.ts";
import { runScenario } from "../src/harness/run-scenario.ts";
import {
  failingCheckModel,
  failingChecks,
  outcomeSecret,
  passingCheckModel,
} from "./harness-models.ts";

void test("E01 already valid fix is carried through approval, send and observed recovery", async () => {
  const output = await runScenario("E01", 1, { model: passingCheckModel, outcomeSecret });
  const verdict = checkArtifact(output.artifact, outcomeSecret);
  assert.equal(
    verdict.passed,
    true,
    `${failingChecks(verdict)} | notes: ${output.notes.join("; ")}`,
  );
  assert.deepEqual(output.notes, []);
  assert.equal(
    output.artifact.verifications.every((verification) => verification.result === "PASS"),
    true,
  );
  assert.deepEqual(output.artifact.sourceChallenges, ["DISTRACTOR"]);
});

void test("E02 closed issue still broken retains the failed check and sends only after the fix", async () => {
  const output = await runScenario("E02", 1, { model: failingCheckModel, outcomeSecret });
  const verdict = checkArtifact(output.artifact, outcomeSecret);
  assert.equal(
    verdict.passed,
    true,
    `${failingChecks(verdict)} | notes: ${output.notes.join("; ")}`,
  );
  assert.deepEqual(output.notes, []);
  assert.equal(output.artifact.approvalCallbacks.length, 1);
  assert.equal(output.artifact.approvalCallbacks[0]?.accepted, true);
  assert.equal(
    output.artifact.providerEffects.filter((effect) => effect.provider === "gmail").length,
    1,
  );
});
