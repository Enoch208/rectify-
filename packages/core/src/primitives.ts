import { z } from "zod";

export const identifierSchema = z.string().min(1);
export const timestampSchema = z.iso.datetime({ offset: true });
export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

export const environmentLabelSchema = z.enum([
  "LIVE PROVIDER",
  "ARGA TWIN",
  "LOCAL FIXTURE",
  "RECORDED REPLAY",
  "NOT RUN",
]);

export type EnvironmentLabel = z.infer<typeof environmentLabelSchema>;

export const providerSchema = z.enum(["gmail", "github", "slack", "reportdesk"]);

export type Provider = z.infer<typeof providerSchema>;

export const providerEnvironmentsSchema = z.object({
  gmail: environmentLabelSchema,
  github: environmentLabelSchema,
  slack: environmentLabelSchema,
  reportdesk: environmentLabelSchema,
});

export type ProviderEnvironments = z.infer<typeof providerEnvironmentsSchema>;
