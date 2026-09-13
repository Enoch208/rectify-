import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import { test } from "node:test";
import {
  createReportDeskServer,
  executeCsvExport,
  fixtureManifest,
  initialTenantConfigs,
  ReportDeskStore,
  verifyOutcomeEvent,
} from "../src/index.ts";

const probeToken = "probe-secret";
const operatorToken = "operator-secret";
const customerToken = "customer-secret";
const outcomeSecret = "outcome-secret";

const startServer = async (store: ReportDeskStore) => {
  const server = createReportDeskServer({
    store,
    manifest: fixtureManifest,
    probeToken,
    operatorToken,
    operatorId: "operator-1",
    customerSessions: [{ token: customerToken, tenantId: "northstar", actorId: "maya" }],
    outcomeSecret,
    now: () => new Date("2026-09-13T12:00:00.000Z"),
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${String(address.port)}` };
};

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
  assert.equal(broken.body.split("\n").filter(Boolean).length, 1);
  assert.match(working.body, /hb-2026-08-001/u);
});

void test("authenticated demo fix advances revision and records its human audit event", async () => {
  const store = new ReportDeskStore(initialTenantConfigs);
  const { server, baseUrl } = await startServer(store);
  try {
    const denied = await fetch(`${baseUrl}/api/demo/fix`, {
      method: "POST",
      headers: { authorization: "Bearer wrong", "content-type": "application/json" },
      body: JSON.stringify({ tenantId: "northstar" }),
    });
    const accepted = await fetch(`${baseUrl}/api/demo/fix`, {
      method: "POST",
      headers: { authorization: `Bearer ${operatorToken}`, "content-type": "application/json" },
      body: JSON.stringify({ tenantId: "northstar" }),
    });

    assert.equal(denied.status, 401);
    assert.equal(accepted.status, 200);
    assert.deepEqual(store.getConfig("northstar"), {
      tenantId: "northstar",
      fixedPathEnabled: true,
      revision: 2,
    });
    const auditEvent = store.getAuditEvents()[0];
    assert.ok(auditEvent);
    assert.equal(auditEvent.kind, "HUMAN_APPLIED_DEMO_CONFIGURATION_FIX");
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

void test("customer and probe routes share export behavior while only customer signs outcomes", async () => {
  const store = new ReportDeskStore(initialTenantConfigs);
  const { server, baseUrl } = await startServer(store);
  try {
    const probe = await fetch(`${baseUrl}/api/probe/export`, {
      method: "POST",
      headers: { authorization: `Bearer ${probeToken}`, "content-type": "application/json" },
      body: JSON.stringify({ tenantId: "northstar", period: "2026-08" }),
    });
    const customer = await fetch(`${baseUrl}/api/customer/export`, {
      method: "POST",
      headers: { authorization: `Bearer ${customerToken}`, "content-type": "application/json" },
      body: JSON.stringify({ caseId: "case-1", period: "2026-08" }),
    });
    const [probeBody, customerBody] = await Promise.all([probe.text(), customer.text()]);
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
    server.closeAllConnections();
    server.close();
  }
});
