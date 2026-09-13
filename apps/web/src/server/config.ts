import { environmentLabelSchema, type ProviderEnvironments } from "@rectify/core";
import { z } from "zod";
import { HttpError } from "./errors.ts";

const intakeEntrySchema = z.object({
  gmailThreadId: z.string().min(1),
  organizationId: z.string().min(1),
  tenantId: z.string().min(1),
  contactId: z.string().min(1),
  contactEmail: z.email(),
});

export type IntakeEntry = z.infer<typeof intakeEntrySchema>;

export const requireEnvironment = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new HttpError(503, `Server configuration is missing ${name}`);
  }
  return value;
};

export const getIntakeDirectory = (): readonly IntakeEntry[] => {
  const raw = requireEnvironment("RECTIFY_INTAKE_DIRECTORY_JSON");
  const decoded: unknown = JSON.parse(raw);
  return z.array(intakeEntrySchema).parse(decoded);
};

const modeLabel = (mode: string | undefined) => {
  if (mode === undefined) {
    return "NOT RUN" as const;
  }
  switch (mode) {
    case "live":
      return "LIVE PROVIDER" as const;
    case "arga":
      return "ARGA TWIN" as const;
    case "local_fixture":
      return "LOCAL FIXTURE" as const;
    default:
      return "NOT RUN" as const;
  }
};

export const getProviderEnvironments = (): ProviderEnvironments => ({
  gmail: modeLabel(process.env.GMAIL_MODE),
  github: modeLabel(process.env.GITHUB_MODE),
  slack: modeLabel(process.env.SLACK_MODE),
  reportdesk: environmentLabelSchema.parse(process.env.REPORTDESK_ENVIRONMENT ?? "NOT RUN"),
});

export const getApproverIds = (): ReadonlySet<string> => {
  const ids = requireEnvironment("SLACK_APPROVER_IDS")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (ids.length === 0) {
    throw new HttpError(503, "Server configuration has no Slack approvers");
  }
  return new Set(ids);
};
