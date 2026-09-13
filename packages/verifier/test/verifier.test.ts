import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import {
  createReportDeskServer,
  fixtureManifest,
  initialTenantConfigs,
  ReportDeskStore,
} from "@rectify/reportdesk";
import { verifyCsvExport } from "../src/index.ts";

const probeToken = "probe-secret";

const listen = async (server: Server): Promise<string> => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${String(address.port)}`;
};

const reportDesk = () => {
  const store = new ReportDeskStore(initialTenantConfigs);
  const server = createReportDeskServer({
    store,
    manifest: fixtureManifest,
    probeToken,
    operatorToken: "operator-secret",
    operatorId: "operator-1",
    customerSessions: [],
    outcomeSecret: "outcome-secret",
    productEventsUrl: "http://127.0.0.1:9/unused",
  });
  return { store, server };
};

const requestFor = (baseUrl: string, tenantId: string) => ({
  caseId: `case-${tenantId}`,
  baseUrl,
  tenantId,
  period: "2026-08",
  manifest: fixtureManifest,
  configRevision: 1,
  probeCredentialId: "probe-1",
  probeToken,
  timeoutMs: 1_000,
});

void test("HTTP 200 with Northstar empty CSV fails exact manifest verification", async () => {
  const { server } = reportDesk();
  const baseUrl = await listen(server);
  try {
    const result = await verifyCsvExport(requestFor(baseUrl, "northstar"));

    assert.equal(result.observed.httpStatus, 200);
    assert.equal(result.observed.rows.length, 0);
    assert.equal(result.result, "FAIL");
    assert.match(result.observed.failureReason ?? "", /exactly match/u);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

void test("a manifest that legitimately expects zero rows passes", async () => {
  const { server } = reportDesk();
  const baseUrl = await listen(server);
  try {
    const result = await verifyCsvExport(requestFor(baseUrl, "quiet-labs"));

    assert.equal(result.expected.rows.length, 0);
    assert.equal(result.observed.rows.length, 0);
    assert.equal(result.result, "PASS");
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

void test("a verifier timeout is inconclusive", async () => {
  const server = createServer(() => undefined);
  const baseUrl = await listen(server);
  try {
    const result = await verifyCsvExport({
      ...requestFor(baseUrl, "harbor"),
      timeoutMs: 20,
    });

    assert.equal(result.result, "INCONCLUSIVE");
    assert.equal(result.observed.httpStatus, null);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});
