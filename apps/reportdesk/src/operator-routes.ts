import { z } from "zod";
import type { Route } from "./context.ts";
import { deliverOutcomeEvent } from "./delivery.ts";
import { HttpError, readJsonBody, requireBearer, sendJson } from "./http.ts";
import { initialTenantConfigs } from "./store.ts";

const demoFixRequestSchema = z.object({ tenantId: z.string().min(1) });
const redeliverRequestSchema = z.object({ eventId: z.string().min(1) });

const demoFix: Route = {
  method: "POST",
  path: "/api/demo/fix",
  handle: async (context) => {
    const { desk } = context;
    if (!requireBearer(context, desk.operatorToken, "operator")) {
      return;
    }
    const input = await readJsonBody(context.request, demoFixRequestSchema);
    const applied = desk.store.applyDemoFix(
      input.tenantId,
      desk.operatorId,
      desk.now().toISOString(),
      desk.createId(),
    );
    sendJson(context.response, 200, applied);
  },
};

const demoReset: Route = {
  method: "POST",
  path: "/api/demo/reset",
  handle: (context) => {
    const { desk } = context;
    if (!requireBearer(context, desk.operatorToken, "operator")) {
      return;
    }
    desk.store.reset(initialTenantConfigs);
    sendJson(context.response, 200, { reset: true });
  },
};

const operatorAudit: Route = {
  method: "GET",
  path: "/api/operator/audit",
  handle: (context) => {
    const { desk } = context;
    if (!requireBearer(context, desk.operatorToken, "operator")) {
      return;
    }
    sendJson(context.response, 200, {
      auditEvents: desk.store.getAuditEvents(),
      outcomeEvents: desk.store.getOutcomeEvents(),
      deliveries: desk.store.getDeliveries(),
    });
  },
};

const operatorRedeliver: Route = {
  method: "POST",
  path: "/api/operator/redeliver",
  handle: async (context) => {
    const { desk } = context;
    if (!requireBearer(context, desk.operatorToken, "operator")) {
      return;
    }
    const input = await readJsonBody(context.request, redeliverRequestSchema);
    const event = desk.store.getOutcomeEvent(input.eventId);
    if (event === undefined) {
      throw new HttpError(404, `Unknown outcome event: ${input.eventId}`);
    }
    const delivery = await deliverOutcomeEvent(desk, event);
    sendJson(context.response, delivery.status === "DELIVERED" ? 200 : 502, { delivery });
  },
};

export const operatorRoutes: readonly Route[] = [
  demoFix,
  demoReset,
  operatorAudit,
  operatorRedeliver,
];
