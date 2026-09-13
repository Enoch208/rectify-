import { createHash, randomUUID } from "node:crypto";
import {
  type CsvExportExpectation,
  type VerificationRecord,
  verificationRecordSchema,
} from "@rectify/core";
import { parseExportCsv } from "./csv.ts";
import { verifierManifestSchema, type VerifierManifest } from "./manifest.ts";

export interface VerifyCsvExportRequest {
  caseId: string;
  baseUrl: string;
  tenantId: string;
  period: string;
  manifest: VerifierManifest;
  configRevision: number;
  probeCredentialId: string;
  probeToken: string;
  timeoutMs: number;
  requestId?: string;
}

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");

const normalizedRows = (rows: CsvExportExpectation["rows"]): string =>
  JSON.stringify([...rows].sort((left, right) => left.recordId.localeCompare(right.recordId)));

const expectedFor = (
  manifest: VerifierManifest,
  tenantId: string,
  period: string,
): CsvExportExpectation => {
  const fixture = manifest.tenants.find(
    (candidate) => candidate.tenantId === tenantId && candidate.period === period,
  );
  if (fixture === undefined) {
    throw new Error(`No verifier manifest entry for ${tenantId} in ${period}`);
  }
  return { schema: manifest.schema, rows: fixture.rows };
};

const resultFor = (
  expected: CsvExportExpectation,
  observed: { schema: string[]; rows: CsvExportExpectation["rows"] },
  metadataMatches: boolean,
): { result: "PASS" | "FAIL"; reason: string | null } => {
  if (!metadataMatches) {
    return { result: "FAIL", reason: "Response metadata did not match the requested contract" };
  }
  if (JSON.stringify(observed.schema) !== JSON.stringify(expected.schema)) {
    return { result: "FAIL", reason: "CSV schema did not match the manifest" };
  }
  if (normalizedRows(observed.rows) !== normalizedRows(expected.rows)) {
    return { result: "FAIL", reason: "CSV records did not exactly match the manifest" };
  }
  return { result: "PASS", reason: null };
};

const inconclusiveRecord = (
  request: VerifyCsvExportRequest,
  expected: CsvExportExpectation,
  requestId: string,
  reason: string,
): VerificationRecord =>
  verificationRecordSchema.parse({
    id: randomUUID(),
    caseId: request.caseId,
    contractVersion: "csv-export-v1",
    input: {
      tenantId: request.tenantId,
      period: request.period,
      manifestRevision: request.manifest.revision,
      appRevision: request.manifest.appRevision,
      configRevision: request.configRevision,
      probeCredentialId: request.probeCredentialId,
    },
    requestId,
    expected,
    observed: { httpStatus: null, schema: [], rows: [], failureReason: reason },
    responseHash: null,
    normalizedContentHash: null,
    result: "INCONCLUSIVE",
    verifiedAt: new Date().toISOString(),
  });

export const verifyCsvExport = async (
  input: VerifyCsvExportRequest,
): Promise<VerificationRecord> => {
  const request = { ...input, manifest: verifierManifestSchema.parse(input.manifest) };
  const expected = expectedFor(request.manifest, request.tenantId, request.period);
  const requestId = request.requestId ?? randomUUID();
  let response: Response;
  try {
    response = await fetch(new URL("/api/probe/export", request.baseUrl), {
      method: "POST",
      headers: {
        authorization: `Bearer ${request.probeToken}`,
        "content-type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify({ tenantId: request.tenantId, period: request.period }),
      signal: AbortSignal.timeout(request.timeoutMs),
    });
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "Probe request failed";
    return inconclusiveRecord(request, expected, requestId, reason);
  }
  const body = await response.text();
  let observed: ReturnType<typeof parseExportCsv> = { schema: [], rows: [] };
  let parsingError: string | null = null;
  try {
    observed = parseExportCsv(body);
  } catch (error: unknown) {
    parsingError = error instanceof Error ? error.message : "CSV parsing failed";
  }
  const metadataMatches =
    response.status === 200 &&
    response.headers.get("x-tenant-id") === request.tenantId &&
    response.headers.get("x-period") === request.period &&
    response.headers.get("x-manifest-revision") === String(request.manifest.revision) &&
    response.headers.get("x-app-revision") === String(request.manifest.appRevision) &&
    response.headers.get("x-config-revision") === String(request.configRevision);
  const verdict = parsingError === null ? resultFor(expected, observed, metadataMatches) : null;
  const failureReason = parsingError ?? verdict?.reason ?? null;
  return verificationRecordSchema.parse({
    id: randomUUID(),
    caseId: request.caseId,
    contractVersion: "csv-export-v1",
    input: {
      tenantId: request.tenantId,
      period: request.period,
      manifestRevision: request.manifest.revision,
      appRevision: request.manifest.appRevision,
      configRevision: request.configRevision,
      probeCredentialId: request.probeCredentialId,
    },
    requestId: response.headers.get("x-request-id") ?? requestId,
    expected,
    observed: { httpStatus: response.status, ...observed, failureReason },
    responseHash: hash(body),
    normalizedContentHash: hash(normalizedRows(observed.rows)),
    result: verdict?.result ?? "FAIL",
    verifiedAt: new Date().toISOString(),
  });
};
