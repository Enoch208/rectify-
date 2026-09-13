import type { VerificationRecord } from "@rectify/core";
import { verifyCsvExport, type VerifierManifest } from "@rectify/verifier";
import { z } from "zod";

const probeConfigSchema = z.object({
  tenantId: z.string().min(1),
  configRevision: z.number().int().positive(),
  appRevision: z.number().int().positive(),
  manifestRevision: z.number().int().positive(),
  fixedPathEnabled: z.boolean(),
});

export type ProductConfig = z.infer<typeof probeConfigSchema>;

export interface ReportDeskProbeOptions {
  baseUrl: string;
  probeToken: string;
  probeCredentialId: string;
  manifest: VerifierManifest;
  timeoutMs: number;
}

export interface ReportDeskProbe {
  readonly manifest: VerifierManifest;
  readConfig(tenantId: string): Promise<ProductConfig>;
  verify(input: { caseId: string; tenantId: string; period: string }): Promise<VerificationRecord>;
  periodsFor(tenantId: string): readonly string[];
}

export const createReportDeskProbe = (options: ReportDeskProbeOptions): ReportDeskProbe => {
  const readConfig = async (tenantId: string): Promise<ProductConfig> => {
    const url = new URL("/api/probe/config", options.baseUrl);
    url.searchParams.set("tenantId", tenantId);
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${options.probeToken}` },
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`ReportDesk config read failed with HTTP ${String(response.status)}`);
    }
    return probeConfigSchema.parse(await response.json());
  };

  const periodsFor = (tenantId: string): readonly string[] =>
    options.manifest.tenants
      .filter((tenant) => tenant.tenantId === tenantId)
      .map((tenant) => tenant.period);

  return {
    manifest: options.manifest,
    readConfig,
    periodsFor,
    verify: async ({ caseId, tenantId, period }) => {
      if (!periodsFor(tenantId).includes(period)) {
        throw new Error(`Period ${period} is not in the verification manifest for this tenant`);
      }
      const config = await readConfig(tenantId);
      return verifyCsvExport({
        caseId,
        baseUrl: options.baseUrl,
        tenantId,
        period,
        manifest: options.manifest,
        configRevision: config.configRevision,
        probeCredentialId: options.probeCredentialId,
        probeToken: options.probeToken,
        timeoutMs: options.timeoutMs,
      });
    },
  };
};
