import { randomUUID } from "node:crypto";
import type { FixtureManifest, FixtureRow } from "./fixture-manifest.ts";
import type { ReportDeskStore } from "./store.ts";

export interface ExportRequest {
  tenantId: string;
  period: string;
}

export interface ExportResponse {
  httpStatus: 200;
  contentType: "text/csv; charset=utf-8";
  body: string;
  requestId: string;
  tenantId: string;
  period: string;
  manifestRevision: number;
  appRevision: number;
  configRevision: number;
}

const escapeCsv = (value: string): string => {
  if (!/[",\n\r]/u.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
};

const encodeRow = (row: FixtureRow): string =>
  [row.recordId, row.tenantId, row.period, row.amount, row.status].map(escapeCsv).join(",");

export const encodeExport = (schema: readonly string[], rows: readonly FixtureRow[]): string => {
  const lines = [schema.map(escapeCsv).join(","), ...rows.map(encodeRow)];
  return `${lines.join("\n")}\n`;
};

export const executeCsvExport = (
  store: ReportDeskStore,
  manifest: FixtureManifest,
  request: ExportRequest,
  requestId: string = randomUUID(),
): ExportResponse => {
  const config = store.getConfig(request.tenantId);
  const tenantFixture = manifest.tenants.find(
    (candidate) => candidate.tenantId === request.tenantId && candidate.period === request.period,
  );
  if (tenantFixture === undefined) {
    throw new Error(`No fixture for ${request.tenantId} in ${request.period}`);
  }
  const rows = config.fixedPathEnabled ? tenantFixture.rows : [];
  return {
    httpStatus: 200,
    contentType: "text/csv; charset=utf-8",
    body: encodeExport(manifest.schema, rows),
    requestId,
    tenantId: request.tenantId,
    period: request.period,
    manifestRevision: manifest.revision,
    appRevision: manifest.appRevision,
    configRevision: config.revision,
  };
};
