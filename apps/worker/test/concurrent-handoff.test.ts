import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { executeOnce } from "../src/case-flow.ts";
import { createPipeline } from "./pipeline-harness.ts";
import { northstarInvestigation } from "./scripted-model.ts";

void test("concurrent requests for one logical action dispatch once and never hit a transition error", async () => {
  const pipeline = await createPipeline(northstarInvestigation);
  let dispatches = 0;
  const run = () =>
    executeOnce(
      pipeline.services,
      () => ({
        caseId: pipeline.caseId,
        logicalKey: `case:${pipeline.caseId}:slack-handoff`,
        provider: "slack",
        kind: "POST_SLACK_HANDOFF",
        payload: { text: "handoff" },
      }),
      async () => {
        await delay(20);
        return { authorized: true };
      },
      async () => {
        dispatches += 1;
        await delay(20);
        return { providerIds: ["1.000100"] };
      },
      `case:${pipeline.caseId}:slack-handoff`,
    );
  try {
    const results = await Promise.all([run(), run(), run()]);
    assert.deepEqual(
      results.map((action) => action.status),
      ["CONFIRMED", "CONFIRMED", "CONFIRMED"],
    );
    assert.equal(new Set(results.map((action) => action.id)).size, 1);
    assert.equal(dispatches, 1);
  } finally {
    await pipeline.close();
  }
});
