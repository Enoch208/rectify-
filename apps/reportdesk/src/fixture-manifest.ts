import { z } from "zod";

export const fixtureRowSchema = z.object({
  recordId: z.string().min(1),
  tenantId: z.string().min(1),
  period: z.string().min(1),
  amount: z.string().regex(/^-?\d+(?:\.\d+)?$/u),
  status: z.string().min(1),
});

export const tenantFixtureSchema = z.object({
  tenantId: z.string().min(1),
  period: z.string().min(1),
  rows: z.array(fixtureRowSchema),
});

export const fixtureManifestSchema = z.object({
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
  tenants: z.array(tenantFixtureSchema).min(2),
});

export type FixtureManifest = z.infer<typeof fixtureManifestSchema>;
export type FixtureRow = z.infer<typeof fixtureRowSchema>;

export const fixtureManifest = fixtureManifestSchema.parse({
  version: "2026-09-13.1",
  revision: 1,
  appRevision: 1,
  schema: ["record_id", "tenant_id", "period", "amount", "status"],
  tenants: [
    {
      tenantId: "northstar",
      period: "2026-08",
      rows: [
        {
          recordId: "ns-2026-08-001",
          tenantId: "northstar",
          period: "2026-08",
          amount: "1250.00",
          status: "settled",
        },
      ],
    },
    {
      tenantId: "harbor",
      period: "2026-08",
      rows: [
        {
          recordId: "hb-2026-08-001",
          tenantId: "harbor",
          period: "2026-08",
          amount: "830.50",
          status: "settled",
        },
      ],
    },
    {
      tenantId: "quiet-labs",
      period: "2026-08",
      rows: [],
    },
  ],
});
