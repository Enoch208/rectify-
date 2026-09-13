import assert from "node:assert/strict";
import { test } from "node:test";
import {
  executeCsvExport,
  ExportNotFoundError,
  fixtureManifest,
  initialTenantConfigs,
  ReportDeskStore,
  verifyOutcomeEvent,
} from "../src/index.ts";
import {
  customerToken,
  operatorToken,
  outcomeSecret,
  postJson,
  probeToken,
  startCapture,
  startDesk,
  stop,
} from "./harness.ts";

void test("Northstar returns HTTP-compatible empty CSV until the fixed path is enabled", () => {
  const store = new ReportDeskStore(initialTenantConfigs);
  const broken = executeCsvExport(store, fixtureManifest, {
    tenantId: "northstar",
    period: "2026-08",
  });
  const working = executeCsvExport(store, fixtureManifest, {
    tenantId: "harbor",
    period: "2026-08",
  });

  assert.equal(broken.httpStatus, 200);
  assert.equal(broken.rowCount, 0);
  assert.equal(broken.body.split("\n").filter(Boolean).length, 1);
  assert.match(working.body, /hb-2026-08-001/u);
});

void test("unknown tenant or period raises a not-found export error", () => {
  const store = new ReportDeskStore(initialTenantConfigs);
  assert.throws(
    () => executeCsvExport(store, fixtureManifest, { tenantId: "ghost", period: "2026-08" }),
    ExportNotFoundError,
  );
  assert.throws(
    () => executeCsvExport(store, fixtureManifest, { tenantId: "northstar", period: "1999-01" }),
    ExportNotFoundError,
  );
});

void test("authenticated demo fix advances revision and records its human audit event", async () => {
  const capture = await startCapture();
  const { store, server, baseUrl } = await startDesk(capture.url);
  try {
    const denied = await postJson(`${baseUrl}/api/demo/fix`, "wrong", { tenantId: "northstar" });
    const accepted = await postJson(`${baseUrl}/api/demo/fix`, operatorToken, {
      tenantId: "northstar",
    });
    const unknown = await postJson(`${baseUrl}/api/demo/fix`, operatorToken, { tenantId: "ghost" });

    assert.equal(denied.status, 401);
    assert.equal(accepted.status, 200);
    assert.equal(unknown.status, 404);
    assert.deepEqual(store.getConfig("northstar"), {
      tenantId: "northstar",
      fixedPathEnabled: true,
      revision: 2,
    });
    const auditEvent = store.getAuditEvents()[0];
    assert.ok(auditEvent);
    assert.equal(auditEvent.kind, "HUMAN_APPLIED_DEMO_CONFIGURATION_FIX");
  } finally {
    stop(server);
    stop(capture.server);
  }
});

void test("customer and probe routes share export behavior while only customer signs outcomes", async () => {
  const capture = await startCapture();
  const { store, server, baseUrl } = await startDesk(capture.url);
  try {
    const probe = await postJson(`${baseUrl}/api/probe/export`, probeToken, {
      tenantId: "northstar",
      period: "2026-08",
    });
    const probeBody = await probe.text();
    assert.equal(store.getOutcomeEvents().length, 0);
    assert.equal(store.getDeliveries().length, 0);
    assert.equal(capture.bodies.length, 0);
    assert.equal(probe.headers.get("x-outcome-event-id"), null);

    const customer = await postJson(`${baseUrl}/api/customer/export`, customerToken, {
      caseId: "case-1",
      period: "2026-08",
    });
    const customerBody = await customer.text();
    const outcomes = store.getOutcomeEvents();

    assert.equal(probe.status, 200);
    assert.equal(customer.status, 200);
    assert.equal(probeBody, customerBody);
    assert.equal(outcomes.length, 1);
    const outcome = outcomes[0];
    assert.ok(outcome);
    assert.equal(outcome.actorType, "CUSTOMER");
    assert.equal(outcome.result, "FAILED");
    assert.equal(verifyOutcomeEvent(outcome, outcomeSecret), true);
  } finally {
    stop(server);
    stop(capture.server);
  }
});

void test("unknown routes and malformed bodies return JSON errors", async () => {
  const capture = await startCapture();
  const { server, baseUrl } = await startDesk(capture.url);
  try {
    const missing = await fetch(`${baseUrl}/api/nothing`);
    const malformed = await fetch(`${baseUrl}/api/probe/export`, {
      method: "POST",
      headers: { authorization: `Bearer ${probeToken}`, "content-type": "application/json" },
      body: "{",
    });
    const invalid = await postJson(`${baseUrl}/api/probe/export`, probeToken, { tenantId: "" });

    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: "Not found" });
    assert.equal(malformed.status, 400);
    assert.equal(invalid.status, 400);
    assert.match(malformed.headers.get("content-type") ?? "", /application\/json/u);
  } finally {
    stop(server);
    stop(capture.server);
  }
});
