import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  createReportDeskServer,
  fixtureManifest,
  initialTenantConfigs,
  ReportDeskStore,
} from "../src/index.ts";

export const probeToken = "probe-secret";
export const operatorToken = "operator-secret";
export const customerToken = "customer-secret";
export const outcomeSecret = "outcome-secret";

const listen = async (server: Server): Promise<string> => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${String(address.port)}`;
};

export const stop = (server: Server): void => {
  server.closeAllConnections();
  server.close();
};

export interface CaptureServer {
  server: Server;
  url: string;
  bodies: unknown[];
  setStatus: (status: number) => void;
}

export const startCapture = async (initialStatus = 202): Promise<CaptureServer> => {
  const bodies: unknown[] = [];
  let status = initialStatus;
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      bodies.push({
        contentType: request.headers["content-type"],
        payload: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown,
      });
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify({ accepted: status < 300 }));
    });
  });
  const url = `${await listen(server)}/api/product-events`;
  return {
    server,
    url,
    bodies,
    setStatus: (next) => {
      status = next;
    },
  };
};

export const startDesk = async (productEventsUrl: string) => {
  const store = new ReportDeskStore(initialTenantConfigs);
  const server = createReportDeskServer({
    store,
    manifest: fixtureManifest,
    probeToken,
    operatorToken,
    operatorId: "operator-1",
    customerSessions: [
      {
        token: customerToken,
        tenantId: "northstar",
        actorId: "maya",
        displayName: "Northstar Research demo customer",
      },
    ],
    outcomeSecret,
    productEventsUrl,
    now: () => new Date("2026-09-13T12:00:00.000Z"),
  });
  return { store, server, baseUrl: await listen(server) };
};

export const unreachableUrl = async (): Promise<string> => {
  const server = createServer();
  const url = await listen(server);
  await new Promise((resolve) => server.close(resolve));
  return `${url}/api/product-events`;
};

export const postJson = (url: string, token: string, body: unknown): Promise<Response> =>
  fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

export const getWithToken = (url: string, token: string): Promise<Response> =>
  fetch(url, { headers: { authorization: `Bearer ${token}` } });
