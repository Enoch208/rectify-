import { z } from "zod";
import type { Route } from "./context.ts";
import { executeCsvExport } from "./export.ts";
import { HttpError, readJsonBody, requireBearer, sendExport, sendJson } from "./http.ts";

const probeExportRequestSchema = z.object({
  tenantId: z.string().min(1),
  period: z.string().min(1),
});

const probeExport: Route = {
  method: "POST",
  path: "/api/probe/export",
  handle: async (context) => {
    const { desk } = context;
    if (!requireBearer(context, desk.probeToken, "probe")) {
      return;
    }
    const input = await readJsonBody(context.request, probeExportRequestSchema);
    sendExport(
      context.response,
      executeCsvExport(desk.store, desk.manifest, input, desk.createId()),
    );
  },
};

const probeConfig: Route = {
  method: "GET",
  path: "/api/probe/config",
  handle: (context) => {
    const { desk } = context;
    if (!requireBearer(context, desk.probeToken, "probe")) {
      return;
    }
    const tenantId = context.url.searchParams.get("tenantId");
    if (tenantId === null || tenantId.length === 0) {
      throw new HttpError(400, "tenantId query parameter is required");
    }
    const config = desk.store.getConfig(tenantId);
    sendJson(context.response, 200, {
      tenantId: config.tenantId,
      configRevision: config.revision,
      appRevision: desk.manifest.appRevision,
      manifestRevision: desk.manifest.revision,
      fixedPathEnabled: config.fixedPathEnabled,
    });
  },
};

export const probeRoutes: readonly Route[] = [probeExport, probeConfig];
