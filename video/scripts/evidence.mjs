import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "../..");
const env = JSON.parse(readFileSync(resolve(root, ".data/video-runtime.json"), "utf8"));
const id = readFileSync(resolve(root, "video/public/footage/case-id.txt"), "utf8");
async function get(path) {
  const response = await fetch(`http://127.0.0.1:3400/api/${path}`, {
    headers: { authorization: `Bearer ${env.RECTIFY_OPERATOR_TOKEN}` },
  });
  if (!response.ok) throw new Error(`Evidence request failed: ${response.status}`);
  return response.json();
}
const detail = await get(`cases/${id}`);
const { runs } = await get("runs");
const run = runs.find((item) => item.caseId === id && item.configId === "investigate");
assert.ok(run, "Investigation run not found");
assert.equal(run.status, "SUCCEEDED");
assert.equal(detail.case.state, "RECOVERED");
assert.equal(detail.case.syncState, "COMPLETE");
assert.equal(detail.actions.filter((action) => action.kind === "SEND_CUSTOMER_EMAIL").length, 1);
assert.ok(detail.actions.every((action) => action.status === "CONFIRMED"));
const report = {
  recordedAt: new Date().toISOString(),
  caseId: id,
  caseState: detail.case.state,
  notificationState: detail.case.notificationState,
  recoveryState: detail.case.recoveryState,
  syncState: detail.case.syncState,
  environments: detail.environments,
  run: {
    id: run.id,
    model: run.modelId,
    status: run.status,
    toolCallCount: run.toolCallCount,
    durationMs: run.durationMs,
    commit: run.commit,
    traceId: run.traceId,
  },
  verifications: detail.verifications.map((item) => ({
    result: item.result,
    configRevision: item.input.configRevision,
    httpStatus: item.observed.httpStatus,
    expectedRows: item.expected.rows.length,
    observedRows: item.observed.rows.length,
  })),
  actions: detail.actions.map((action) => ({
    kind: action.kind,
    status: action.status,
    attempts: action.attempts.length,
  })),
  limitations: [
    "Fixture providers, not live Gmail, GitHub or Slack",
    "One recorded run, not an eighteen-trial evaluation",
    "Openable Lemma trace not verified",
  ],
};
mkdirSync(resolve(root, "video/out"), { recursive: true });
writeFileSync(resolve(root, "video/out/workflow-evidence.json"), JSON.stringify(report, null, 2));
process.stdout.write("Verified and saved redacted workflow evidence\n");
