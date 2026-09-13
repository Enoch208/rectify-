import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { ReportDeskContext, ReportDeskServerOptions, Route } from "./context.ts";
import { customerRoutes } from "./customer-routes.ts";
import { ExportNotFoundError } from "./export.ts";
import { HttpError, sendJson } from "./http.ts";
import { operatorRoutes } from "./operator-routes.ts";
import { pageRoutes } from "./page-routes.ts";
import { probeRoutes } from "./probe-routes.ts";
import { UnknownTenantError } from "./store.ts";

export type { CustomerSession, ReportDeskServerOptions } from "./context.ts";

const routes: readonly Route[] = [
  ...probeRoutes,
  ...customerRoutes,
  ...operatorRoutes,
  ...pageRoutes,
];

const errorStatus = (error: unknown): number => {
  if (error instanceof HttpError) {
    return error.status;
  }
  if (error instanceof ExportNotFoundError || error instanceof UnknownTenantError) {
    return 404;
  }
  return 500;
};

const handleRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  desk: ReportDeskContext,
): Promise<void> => {
  const url = new URL(request.url ?? "/", "http://reportdesk.local");
  const route = routes.find(
    (candidate) => candidate.method === request.method && candidate.path === url.pathname,
  );
  if (route === undefined) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }
  await route.handle({ request, response, url, desk });
};

const respondWithError = (response: ServerResponse, error: unknown): void => {
  const status = errorStatus(error);
  if (status === 500) {
    console.error(error);
  }
  if (response.headersSent) {
    response.destroy();
    return;
  }
  sendJson(response, status, {
    error: status === 500 || !(error instanceof Error) ? "Internal server error" : error.message,
  });
};

export const createReportDeskServer = (options: ReportDeskServerOptions): Server => {
  const desk: ReportDeskContext = {
    ...options,
    now: options.now ?? (() => new Date()),
    createId: options.createId ?? randomUUID,
  };
  return createServer((request, response) => {
    handleRequest(request, response, desk).catch((error: unknown) => {
      respondWithError(response, error);
    });
  });
};
