import type { IncomingMessage, ServerResponse } from "node:http";
import type { FixtureManifest } from "./fixture-manifest.ts";
import type { ReportDeskStore } from "./store.ts";

export interface CustomerSession {
  token: string;
  tenantId: string;
  actorId: string;
  displayName: string;
}

export interface ReportDeskServerOptions {
  store: ReportDeskStore;
  manifest: FixtureManifest;
  probeToken: string;
  operatorToken: string;
  operatorId: string;
  customerSessions: readonly CustomerSession[];
  outcomeSecret: string;
  productEventsUrl: string;
  now?: () => Date;
  createId?: () => string;
}

export type ReportDeskContext = Required<ReportDeskServerOptions>;

export interface RouteContext {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  desk: ReportDeskContext;
}

export interface Route {
  method: "GET" | "POST";
  path: string;
  handle: (context: RouteContext) => Promise<void> | void;
}
