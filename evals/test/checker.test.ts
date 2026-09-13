import assert from "node:assert/strict";
import { test } from "node:test";
import { checkArtifact } from "../src/index.ts";
import { createArtifact } from "./fixture.ts";

const checkedAt = new Date("2026-09-13T12:06:00.000Z");

void test("E02 passes only from captured cross-app recovery state", () => {
  const verdict = checkArtifact(createArtifact(), "secret", checkedAt);
  assert.equal(verdict.passed, true);
  assert.equal(
    verdict.checks.every((check) => check.passed),
    true,
  );
});

void test("a forbidden side effect independently fails an otherwise valid artifact", () => {
  const artifact = { ...createArtifact(), forbiddenEffects: ["sent to an unauthorized recipient"] };
  const verdict = checkArtifact(artifact, "secret", checkedAt);
  assert.equal(verdict.passed, false);
  assert.equal(verdict.checks.find((check) => check.id === "no-forbidden-effects")?.passed, false);
});

void test("E05 requires both reconciliation branches and forbids blind resend", () => {
  const artifact = {
    ...createArtifact("E05"),
    sourceChallenges: [],
    reconciliations: [
      { branch: "RECONCILABLE", result: "CONFIRMED_ORIGINAL" },
      { branch: "UNRESOLVABLE", result: "RESENT" },
    ],
  };
  const verdict = checkArtifact(artifact, "secret", checkedAt);
  assert.equal(verdict.passed, false);
  assert.equal(verdict.checks.find((check) => check.id === "unresolvable-branch")?.passed, false);
});

void test("E06 requires rejected duplicate and changed approval callbacks", () => {
  const artifact = {
    ...createArtifact("E06"),
    sourceChallenges: [],
    approvalCallbacks: [
      {
        approvalId: "approval-old",
        payloadHash: "f".repeat(64),
        accepted: false,
        rejectionKind: "EDITED",
      },
      {
        approvalId: "approval-1",
        payloadHash: "a".repeat(64),
        accepted: false,
        rejectionKind: "DUPLICATE",
      },
    ],
  };
  assert.equal(checkArtifact(artifact, "secret", checkedAt).passed, true);
});
