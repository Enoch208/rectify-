import { z } from "zod";
import type { EvaluationArtifact } from "../schema.ts";
import type { ScenarioEnvironment } from "./environment.ts";

const auditResponseSchema = z.object({
  auditEvents: z.array(
    z.object({
      kind: z.literal("HUMAN_APPLIED_DEMO_CONFIGURATION_FIX"),
      tenantId: z.string().min(1),
      occurredAt: z.string().min(1),
      toRevision: z.number().int().positive(),
    }),
  ),
});

export interface CustomerExportResult {
  httpStatus: number;
  delivery: string | null;
}

const reportdesk = (
  env: ScenarioEnvironment,
  method: "GET" | "POST",
  path: string,
  token: string,
  body?: unknown,
): Promise<Response> =>
  fetch(new URL(path, env.reportdeskUrl), {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10_000),
  });

export const applyDemoFix = async (env: ScenarioEnvironment, tenantId: string): Promise<void> => {
  const response = await reportdesk(env, "POST", "/api/demo/fix", env.secrets.operator, {
    tenantId,
  });
  await response.arrayBuffer();
  if (!response.ok) {
    throw new Error(`ReportDesk demo fix failed with HTTP ${String(response.status)}`);
  }
};

export const exportAsCustomer = async (
  env: ScenarioEnvironment,
  caseId: string,
): Promise<CustomerExportResult> => {
  const response = await reportdesk(env, "POST", "/api/customer/export", env.secrets.customer, {
    caseId,
    period: env.seed.period,
  });
  await response.arrayBuffer();
  return { httpStatus: response.status, delivery: response.headers.get("x-outcome-delivery") };
};

export const readConfigAudits = async (
  env: ScenarioEnvironment,
): Promise<EvaluationArtifact["configAudits"]> => {
  const response = await reportdesk(env, "GET", "/api/operator/audit", env.secrets.operator);
  if (!response.ok) {
    throw new Error(`ReportDesk audit read failed with HTTP ${String(response.status)}`);
  }
  const audit = auditResponseSchema.parse(await response.json());
  return audit.auditEvents.map((event) => ({
    kind: event.kind,
    tenantId: event.tenantId,
    occurredAt: event.occurredAt,
    toRevision: event.toRevision,
  }));
};
