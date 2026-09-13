import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runEvaluation, scenarioDefinitions } from "../src/index.ts";
import { createPassingArtifact } from "./fixture.ts";

void test("runner requires and writes independent verdicts for all eighteen trials", async () => {
  const directory = mkdtempSync(join(tmpdir(), "rectify-evals-"));
  const artifacts = join(directory, "artifacts");
  const results = join(directory, "results");
  try {
    mkdirSync(artifacts);
    for (const scenario of scenarioDefinitions) {
      for (let trial = 1; trial <= 3; trial += 1) {
        const artifact = createPassingArtifact(scenario.id, trial);
        const name = `${scenario.id}-trial-${String(trial)}.json`;
        writeFileSync(join(artifacts, name), JSON.stringify(artifact), "utf8");
      }
    }
    const verdicts = await runEvaluation({
      artifactDirectory: artifacts,
      resultDirectory: results,
      outcomeSecret: "secret",
      checkedAt: new Date("2026-09-13T12:06:00.000Z"),
    });
    assert.equal(verdicts.length, 18);
    assert.equal(
      verdicts.every((verdict) => verdict.passed),
      true,
    );
    assert.equal(readdirSync(results).length, 18);
  } finally {
    rmSync(directory, { recursive: true });
  }
});
