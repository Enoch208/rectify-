import { z } from "zod";
import type { CustomerSession, Route, RouteContext } from "./context.ts";
import { deliverOutcomeEvent, deliveryHeaderValue } from "./delivery.ts";
import { executeCsvExport } from "./export.ts";
import { bearerToken, matchesSecret, readJsonBody, sendExport, sendJson } from "./http.ts";
import { signOutcomeEvent } from "./outcome.ts";

const customerExportRequestSchema = z.object({
  caseId: z.string().min(1),
  period: z.string().min(1),
});

const authenticateCustomer = (context: RouteContext): CustomerSession | undefined => {
  const received = bearerToken(context.request);
  const session = context.desk.customerSessions.find((candidate) =>
    matchesSecret(received, candidate.token),
  );
  if (session === undefined) {
    sendJson(context.response, 401, { error: "Unauthorized customer session" });
  }
  return session;
};

const customerSession: Route = {
  method: "GET",
  path: "/api/customer/session",
  handle: (context) => {
    const session = authenticateCustomer(context);
    if (session === undefined) {
      return;
    }
    const periods = context.desk.manifest.tenants
      .filter((fixture) => fixture.tenantId === session.tenantId)
      .map((fixture) => fixture.period);
    sendJson(context.response, 200, {
      tenantId: session.tenantId,
      displayName: session.displayName,
      periods,
    });
  },
};

const customerExport: Route = {
  method: "POST",
  path: "/api/customer/export",
  handle: async (context) => {
    const { desk } = context;
    const session = authenticateCustomer(context);
    if (session === undefined) {
      return;
    }
    const input = await readJsonBody(context.request, customerExportRequestSchema);
    const result = executeCsvExport(
      desk.store,
      desk.manifest,
      { tenantId: session.tenantId, period: input.period },
      desk.createId(),
    );
    const fixture = desk.manifest.tenants.find(
      (candidate) => candidate.tenantId === session.tenantId && candidate.period === input.period,
    );
    const event = signOutcomeEvent(
      {
        eventId: desk.createId(),
        caseId: input.caseId,
        tenantId: session.tenantId,
        actorType: "CUSTOMER",
        actorId: session.actorId,
        workflow: "csv-export-v1",
        manifestRevision: result.manifestRevision,
        appRevision: result.appRevision,
        configRevision: result.configRevision,
        requestId: result.requestId,
        result: result.rowCount === fixture?.rows.length ? "SUCCEEDED" : "FAILED",
        occurredAt: desk.now().toISOString(),
      },
      desk.outcomeSecret,
    );
    desk.store.recordOutcomeEvent(event);
    const delivery = await deliverOutcomeEvent(desk, event);
    sendExport(context.response, result, {
      "x-outcome-event-id": event.eventId,
      "x-outcome-delivery": deliveryHeaderValue(delivery),
    });
  },
};

export const customerRoutes: readonly Route[] = [customerSession, customerExport];
