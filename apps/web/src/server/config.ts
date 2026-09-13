import type { ProviderEnvironments } from "@rectify/core";
import {
  parseIntakeDirectory,
  providerEnvironmentsFrom,
  StatusError,
  type IntakeEntry,
} from "@rectify/store";

export type { IntakeEntry };

export const requireEnvironment = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new StatusError(503, `Server configuration is missing ${name}`);
  }
  return value;
};

export const getIntakeDirectory = (): readonly IntakeEntry[] =>
  parseIntakeDirectory(requireEnvironment("RECTIFY_INTAKE_DIRECTORY_JSON"));

export const getProviderEnvironments = (): ProviderEnvironments =>
  providerEnvironmentsFrom({
    gmail: process.env.GMAIL_MODE,
    github: process.env.GITHUB_MODE,
    slack: process.env.SLACK_MODE,
    reportdesk: process.env.REPORTDESK_ENVIRONMENT,
  });

export const getApproverIds = (): ReadonlySet<string> => {
  const ids = requireEnvironment("SLACK_APPROVER_IDS")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (ids.length === 0) {
    throw new StatusError(503, "Server configuration has no Slack approvers");
  }
  return new Set(ids);
};
