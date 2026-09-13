import assert from "node:assert/strict";
import { test } from "node:test";
import {
  customerToken,
  getWithToken,
  operatorToken,
  postJson,
  probeToken,
  startCapture,
  startDesk,
  stop,
} from "./harness.ts";

void test("operator audit returns audit events, outcome events and deliveries", async () => {
  const capture = await startCapture();
  const { server, baseUrl } = await startDesk(capture.url);
  try {
    await postJson(`${baseUrl}/api/demo/fix`, operatorToken, { tenantId: "northstar" });
    const exported = await postJson(`${baseUrl}/api/customer/export`, customerToken, {
      caseId: "case-1",
      period: "2026-08",
    });
    await exported.text();

    const denied = await getWithToken(`${baseUrl}/api/operator/audit`, probeToken);
    const audit = await getWithToken(`${baseUrl}/api/operator/audit`, operatorToken);

    assert.equal(denied.status, 401);
    assert.equal(audit.status, 200);
    const body = (await audit.json()) as {
      auditEvents: { toRevision: number; actorId: string }[];
      outcomeEvents: { eventId: string; actorType: string }[];
      deliveries: { eventId: string; status: string }[];
    };
    assert.equal(body.auditEvents.length, 1);
    assert.equal(body.outcomeEvents.length, 1);
    assert.equal(body.deliveries.length, 1);
    const [auditEvent] = body.auditEvents;
    const [outcomeEvent] = body.outcomeEvents;
    const [delivery] = body.deliveries;
    assert.ok(auditEvent && outcomeEvent && delivery);
    assert.equal(auditEvent.toRevision, 2);
    assert.equal(auditEvent.actorId, "operator-1");
    assert.equal(outcomeEvent.actorType, "CUSTOMER");
    assert.equal(delivery.eventId, outcomeEvent.eventId);
    assert.equal(delivery.status, "DELIVERED");
  } finally {
    stop(server);
    stop(capture.server);
  }
});

void test("demo reset restores initial configs and clears all recorded events", async () => {
  const capture = await startCapture();
  const { store, server, baseUrl } = await startDesk(capture.url);
  try {
    await postJson(`${baseUrl}/api/demo/fix`, operatorToken, { tenantId: "northstar" });
    const exported = await postJson(`${baseUrl}/api/customer/export`, customerToken, {
      caseId: "case-1",
      period: "2026-08",
    });
    await exported.text();

    const denied = await postJson(`${baseUrl}/api/demo/reset`, probeToken, {});
    assert.equal(denied.status, 401);
    assert.equal(store.getConfig("northstar").revision, 2);

    const reset = await postJson(`${baseUrl}/api/demo/reset`, operatorToken, {});
    assert.equal(reset.status, 200);
    assert.deepEqual(await reset.json(), { reset: true });
    assert.deepEqual(store.getConfig("northstar"), {
      tenantId: "northstar",
      fixedPathEnabled: false,
      revision: 1,
    });
    assert.deepEqual(store.getAuditEvents(), []);
    assert.deepEqual(store.getOutcomeEvents(), []);
    assert.deepEqual(store.getDeliveries(), []);
    assert.deepEqual(store.getTenantIds(), ["northstar", "harbor", "quiet-labs"]);
  } finally {
    stop(server);
    stop(capture.server);
  }
});

void test("customer session endpoint identifies the tenant and its fixture periods", async () => {
  const capture = await startCapture();
  const { server, baseUrl } = await startDesk(capture.url);
  try {
    const denied = await getWithToken(`${baseUrl}/api/customer/session`, probeToken);
    const session = await getWithToken(`${baseUrl}/api/customer/session`, customerToken);

    assert.equal(denied.status, 401);
    assert.deepEqual(await session.json(), {
      tenantId: "northstar",
      displayName: "Northstar Research demo customer",
      periods: ["2026-08"],
    });
  } finally {
    stop(server);
    stop(capture.server);
  }
});
