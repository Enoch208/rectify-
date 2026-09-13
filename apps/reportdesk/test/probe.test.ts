import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getWithToken,
  operatorToken,
  postJson,
  probeToken,
  startCapture,
  startDesk,
  stop,
} from "./harness.ts";

void test("probe config requires the probe token, a tenant id and a known tenant", async () => {
  const capture = await startCapture();
  const { server, baseUrl } = await startDesk(capture.url);
  try {
    const denied = await getWithToken(`${baseUrl}/api/probe/config?tenantId=northstar`, "wrong");
    const operatorDenied = await getWithToken(
      `${baseUrl}/api/probe/config?tenantId=northstar`,
      operatorToken,
    );
    const missing = await getWithToken(`${baseUrl}/api/probe/config`, probeToken);
    const unknown = await getWithToken(`${baseUrl}/api/probe/config?tenantId=ghost`, probeToken);

    assert.equal(denied.status, 401);
    assert.deepEqual(await denied.json(), { error: "Unauthorized probe" });
    assert.equal(operatorDenied.status, 401);
    assert.equal(missing.status, 400);
    assert.equal(unknown.status, 404);
    assert.match(unknown.headers.get("content-type") ?? "", /application\/json/u);
  } finally {
    stop(server);
    stop(capture.server);
  }
});

void test("probe config reports current revisions and observes the human fix", async () => {
  const capture = await startCapture();
  const { server, baseUrl } = await startDesk(capture.url);
  try {
    const configUrl = `${baseUrl}/api/probe/config?tenantId=northstar`;
    const before = await getWithToken(configUrl, probeToken);
    assert.equal(before.status, 200);
    assert.deepEqual(await before.json(), {
      tenantId: "northstar",
      configRevision: 1,
      appRevision: 1,
      manifestRevision: 1,
      fixedPathEnabled: false,
    });

    const fix = await postJson(`${baseUrl}/api/demo/fix`, operatorToken, { tenantId: "northstar" });
    assert.equal(fix.status, 200);

    const after = await getWithToken(configUrl, probeToken);
    assert.deepEqual(await after.json(), {
      tenantId: "northstar",
      configRevision: 2,
      appRevision: 1,
      manifestRevision: 1,
      fixedPathEnabled: true,
    });
  } finally {
    stop(server);
    stop(capture.server);
  }
});

void test("probe export returns 404 JSON for unknown tenant or period", async () => {
  const capture = await startCapture();
  const { server, baseUrl } = await startDesk(capture.url);
  try {
    const tenant = await postJson(`${baseUrl}/api/probe/export`, probeToken, {
      tenantId: "ghost",
      period: "2026-08",
    });
    const period = await postJson(`${baseUrl}/api/probe/export`, probeToken, {
      tenantId: "northstar",
      period: "1999-01",
    });

    assert.equal(tenant.status, 404);
    assert.equal(period.status, 404);
    const body = (await period.json()) as { error: string };
    assert.match(body.error, /northstar/u);
  } finally {
    stop(server);
    stop(capture.server);
  }
});

void test("a passing probe export after the fix never records or delivers outcome events", async () => {
  const capture = await startCapture();
  const { store, server, baseUrl } = await startDesk(capture.url);
  try {
    await postJson(`${baseUrl}/api/demo/fix`, operatorToken, { tenantId: "northstar" });
    const probe = await postJson(`${baseUrl}/api/probe/export`, probeToken, {
      tenantId: "northstar",
      period: "2026-08",
    });

    assert.equal(probe.status, 200);
    assert.equal(probe.headers.get("x-config-revision"), "2");
    assert.match(await probe.text(), /ns-2026-08-001/u);
    assert.equal(probe.headers.get("x-outcome-delivery"), null);
    assert.equal(store.getOutcomeEvents().length, 0);
    assert.equal(store.getDeliveries().length, 0);
    assert.equal(capture.bodies.length, 0);
  } finally {
    stop(server);
    stop(capture.server);
  }
});
