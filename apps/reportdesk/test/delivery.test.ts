import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyOutcomeEvent } from "../src/index.ts";
import {
  customerToken,
  operatorToken,
  outcomeSecret,
  postJson,
  startCapture,
  startDesk,
  stop,
  unreachableUrl,
} from "./harness.ts";

const exportBody = { caseId: "case-1", period: "2026-08" };

void test("customer export after the fix delivers the signed success event to Rectify", async () => {
  const capture = await startCapture();
  const { store, server, baseUrl } = await startDesk(capture.url);
  try {
    await postJson(`${baseUrl}/api/demo/fix`, operatorToken, { tenantId: "northstar" });
    const response = await postJson(`${baseUrl}/api/customer/export`, customerToken, exportBody);

    assert.equal(response.status, 200);
    assert.match(await response.text(), /ns-2026-08-001/u);
    assert.equal(response.headers.get("x-outcome-delivery"), "delivered");
    const [event] = store.getOutcomeEvents();
    assert.ok(event);
    assert.equal(response.headers.get("x-outcome-event-id"), event.eventId);
    assert.equal(event.result, "SUCCEEDED");
    assert.equal(event.configRevision, 2);
    assert.equal(verifyOutcomeEvent(event, outcomeSecret), true);
    assert.deepEqual(capture.bodies, [{ contentType: "application/json", payload: event }]);
    assert.deepEqual(store.getDeliveries(), [
      {
        eventId: event.eventId,
        status: "DELIVERED",
        httpStatus: 202,
        error: null,
        attemptedAt: "2026-09-13T12:00:00.000Z",
      },
    ]);
  } finally {
    stop(server);
    stop(capture.server);
  }
});

void test("rejected delivery still returns the CSV and records the HTTP failure", async () => {
  const capture = await startCapture(503);
  const { store, server, baseUrl } = await startDesk(capture.url);
  try {
    const response = await postJson(`${baseUrl}/api/customer/export`, customerToken, exportBody);

    assert.equal(response.status, 200);
    assert.match(await response.text(), /^record_id,tenant_id,period,amount,status\n$/u);
    assert.equal(response.headers.get("x-outcome-delivery"), "failed-503");
    const [delivery] = store.getDeliveries();
    assert.ok(delivery);
    assert.equal(delivery.status, "FAILED");
    assert.equal(delivery.httpStatus, 503);
    assert.equal(capture.bodies.length, 1);
    assert.equal(store.getOutcomeEvents().length, 1);
  } finally {
    stop(server);
    stop(capture.server);
  }
});

void test("unreachable Rectify still returns the CSV and records a network failure", async () => {
  const { store, server, baseUrl } = await startDesk(await unreachableUrl());
  try {
    const response = await postJson(`${baseUrl}/api/customer/export`, customerToken, exportBody);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-outcome-delivery"), "failed-network");
    const [delivery] = store.getDeliveries();
    assert.ok(delivery);
    assert.equal(delivery.status, "FAILED");
    assert.equal(delivery.httpStatus, null);
    assert.equal(typeof delivery.error, "string");
  } finally {
    stop(server);
  }
});

void test("operator redelivers a recorded event after Rectify recovers", async () => {
  const capture = await startCapture(503);
  const { store, server, baseUrl } = await startDesk(capture.url);
  try {
    const exported = await postJson(`${baseUrl}/api/customer/export`, customerToken, exportBody);
    await exported.text();
    const eventId = exported.headers.get("x-outcome-event-id") ?? "";

    const denied = await postJson(`${baseUrl}/api/operator/redeliver`, customerToken, { eventId });
    const unknown = await postJson(`${baseUrl}/api/operator/redeliver`, operatorToken, {
      eventId: "missing-event",
    });
    const stillFailing = await postJson(`${baseUrl}/api/operator/redeliver`, operatorToken, {
      eventId,
    });
    capture.setStatus(200);
    const redelivered = await postJson(`${baseUrl}/api/operator/redeliver`, operatorToken, {
      eventId,
    });

    assert.equal(denied.status, 401);
    assert.equal(unknown.status, 404);
    assert.equal(stillFailing.status, 502);
    assert.equal(redelivered.status, 200);
    const body = (await redelivered.json()) as { delivery: { status: string; eventId: string } };
    assert.equal(body.delivery.status, "DELIVERED");
    assert.equal(body.delivery.eventId, eventId);
    assert.deepEqual(
      store.getDeliveries().map((delivery) => delivery.status),
      ["FAILED", "FAILED", "DELIVERED"],
    );
    assert.equal(capture.bodies.length, 3);
    assert.equal(store.getOutcomeEvents().length, 1);
  } finally {
    stop(server);
    stop(capture.server);
  }
});
