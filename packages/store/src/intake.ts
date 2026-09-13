import {
  environmentLabelSchema,
  type EnvironmentLabel,
  type ProviderEnvironments,
} from "@rectify/core";
import { z } from "zod";

export const intakeEntrySchema = z.object({
  gmailThreadId: z.string().min(1),
  organizationId: z.string().min(1),
  tenantId: z.string().min(1),
  contactId: z.string().min(1),
  contactEmail: z.email(),
});

export type IntakeEntry = z.infer<typeof intakeEntrySchema>;

export const parseIntakeDirectory = (raw: string): readonly IntakeEntry[] => {
  const decoded: unknown = JSON.parse(raw);
  return z.array(intakeEntrySchema).min(1).parse(decoded);
};

export const intakeEntriesForThread = (
  directory: readonly IntakeEntry[],
  gmailThreadId: string,
): readonly IntakeEntry[] => directory.filter((entry) => entry.gmailThreadId === gmailThreadId);

const environmentByMode: Readonly<Record<string, EnvironmentLabel>> = {
  live: "LIVE PROVIDER",
  arga: "ARGA TWIN",
  local_fixture: "LOCAL FIXTURE",
};

export const environmentFromMode = (mode: string | undefined): EnvironmentLabel =>
  (mode === undefined ? undefined : environmentByMode[mode]) ?? "NOT RUN";

export const providerEnvironmentsFrom = (modes: {
  gmail: string | undefined;
  github: string | undefined;
  slack: string | undefined;
  reportdesk: string | undefined;
}): ProviderEnvironments => ({
  gmail: environmentFromMode(modes.gmail),
  github: environmentFromMode(modes.github),
  slack: environmentFromMode(modes.slack),
  reportdesk: environmentLabelSchema.parse(modes.reportdesk ?? "NOT RUN"),
});
