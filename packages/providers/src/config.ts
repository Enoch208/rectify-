import { z } from "zod";
import { providerModeSchema } from "./contracts.ts";

const remoteProviderSchema = z.object({
  mode: z.enum(["live", "arga"]),
  accessToken: z.string().min(1),
  baseUrl: z.url(),
});

export const gmailRemoteConfigSchema = remoteProviderSchema.extend({
  userId: z.string().min(1).default("me"),
  allowedThreadIds: z.array(z.string().min(1)).min(1),
});

export const githubRemoteConfigSchema = remoteProviderSchema.extend({
  owner: z.string().min(1),
  repo: z.string().min(1),
});

export const slackRemoteConfigSchema = remoteProviderSchema.extend({
  channelId: z.string().min(1),
});

export const modeFromEnvironment = (value: string | undefined, name: string) => {
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return providerModeSchema.parse(value);
};

export const requiredEnvironment = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};
