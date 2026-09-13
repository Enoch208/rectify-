import { csvExportRowSchema } from "@rectify/core";
import { z } from "zod";

export const verifierManifestSchema = z.object({
  version: z.string().min(1),
  revision: z.number().int().positive(),
  appRevision: z.number().int().positive(),
  schema: z.tuple([
    z.literal("record_id"),
    z.literal("tenant_id"),
    z.literal("period"),
    z.literal("amount"),
    z.literal("status"),
  ]),
  tenants: z
    .array(
      z.object({
        tenantId: z.string().min(1),
        period: z.string().min(1),
        rows: z.array(csvExportRowSchema),
      }),
    )
    .min(1),
});

export type VerifierManifest = z.infer<typeof verifierManifestSchema>;
