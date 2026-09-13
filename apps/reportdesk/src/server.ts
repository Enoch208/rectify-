import { randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { z } from "zod";
import { executeCsvExport } from "./export.ts";
import type { FixtureManifest } from "./fixture-manifest.ts";
import { signOutcomeEvent } from "./outcome.ts";
import type { ReportDeskStore } from "./store.ts";

const exportRequestSchema = z.object({
  tenantId: z.string().min(1),
  period: z.string().min(1),
});

const customerExportRequestSchema = z.object({
  caseId: z.string().min(1),
  period: z.string().min(1),
});

interface CustomerSession {
  token: string;
  tenantId: string;
  actorId: string;
}

export interface ReportDeskServerOptions {
  store: ReportDeskStore;
  manifest: FixtureManifest;
  probeToken: string;
  operatorToken: string;
  operatorId: string;
  customerSessions: readonly CustomerSession[];
  outcomeSecret: string;
  now?: () => Date;
  createId?: () => string;
}

const matchesSecret = (received: string | undefined, expected: string): boolean => {
  if (received === undefined) {
    return false;
  }
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
};

const bearerToken = (request: IncomingMessage): string | undefined => {
  const authorization = request.headers.authorization;
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
};

const readJson = async (request: IncomingMessage): Promise<unknown> => {
  request.setEncoding("utf8");
  const body = await new Promise<string>((resolve, reject) => {
    let value = "";
    request.on("data", (chunk: string) => {
      value += chunk;
    });
    request.on("end", () => {
      resolve(value);
    });
    request.on("error", reject);
  });
  return JSON.parse(body) as unknown;
};

const sendJson = (response: ServerResponse, status: number, value: unknown): void => {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
};

const sendExport = (
  response: ServerResponse,
  result: ReturnType<typeof executeCsvExport>,
): void => {
  response.writeHead(result.httpStatus, {
    "content-type": result.contentType,
    "x-request-id": result.requestId,
    "x-tenant-id": result.tenantId,
    "x-period": result.period,
    "x-manifest-revision": String(result.manifestRevision),
    "x-app-revision": String(result.appRevision),
    "x-config-revision": String(result.configRevision),
  });
  response.end(result.body);
};

const findCustomerSession = (
  request: IncomingMessage,
  sessions: readonly CustomerSession[],
): CustomerSession | undefined => {
  const received = bearerToken(request);
  return sessions.find((session) => matchesSecret(received, session.token));
};

const handleRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  options: ReportDeskServerOptions,
): Promise<void> => {
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? randomUUID;
  if (request.method === "POST" && request.url === "/api/probe/export") {
    if (!matchesSecret(bearerToken(request), options.probeToken)) {
      sendJson(response, 401, { error: "Unauthorized probe" });
      return;
    }
    const input = exportRequestSchema.parse(await readJson(request));
    sendExport(response, executeCsvExport(options.store, options.manifest, input, createId()));
    return;
  }
  if (request.method === "POST" && request.url === "/api/customer/export") {
    const session = findCustomerSession(request, options.customerSessions);
    if (session === undefined) {
      sendJson(response, 401, { error: "Unauthorized customer session" });
      return;
    }
    const input = customerExportRequestSchema.parse(await readJson(request));
    const result = executeCsvExport(
      options.store,
      options.manifest,
      { tenantId: session.tenantId, period: input.period },
      createId(),
    );
    const fixture = options.manifest.tenants.find(
      (candidate) => candidate.tenantId === session.tenantId && candidate.period === input.period,
    );
    const exportedRowCount = Math.max(0, result.body.trimEnd().split("\n").length - 1);
    const event = signOutcomeEvent(
      {
        eventId: createId(),
        caseId: input.caseId,
        tenantId: session.tenantId,
        actorType: "CUSTOMER",
        actorId: session.actorId,
        workflow: "csv-export-v1",
        manifestRevision: result.manifestRevision,
        appRevision: result.appRevision,
        configRevision: result.configRevision,
        requestId: result.requestId,
        result: exportedRowCount === fixture?.rows.length ? "SUCCEEDED" : "FAILED",
        occurredAt: now().toISOString(),
      },
      options.outcomeSecret,
    );
    options.store.recordOutcomeEvent(event);
    sendExport(response, result);
    return;
  }
  if (request.method === "POST" && request.url === "/api/demo/fix") {
    if (!matchesSecret(bearerToken(request), options.operatorToken)) {
      sendJson(response, 401, { error: "Unauthorized operator" });
      return;
    }
    const input = exportRequestSchema.pick({ tenantId: true }).parse(await readJson(request));
    const config = options.store.applyDemoFix(
      input.tenantId,
      options.operatorId,
      now().toISOString(),
      createId(),
    );
    sendJson(response, 200, { config, auditEvent: options.store.getAuditEvents().at(-1) });
    return;
  }
  sendJson(response, 404, { error: "Not found" });
};

export const createReportDeskServer = (options: ReportDeskServerOptions): Server =>
  createServer((request, response) => {
    void handleRequest(request, response, options).catch((error: unknown) => {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : "Invalid request",
      });
    });
  });
