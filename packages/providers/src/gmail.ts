import type { GmailAdapter } from "./contracts.ts";
import { FixtureGmailAdapter, type GmailFixtureConfig } from "./gmail-fixture.ts";
import { RemoteGmailAdapter } from "./gmail-remote.ts";

export interface GmailLiveConfig {
  mode: "live";
  accessToken: string;
  userId?: string;
  allowedThreadIds: readonly string[];
}

export interface GmailArgaConfig {
  mode: "arga";
  accessToken: string;
  baseUrl: string;
  userId?: string;
  allowedThreadIds: readonly string[];
}

export type GmailConfig = GmailLiveConfig | GmailArgaConfig | GmailFixtureConfig;

export const createGmailAdapter = (config: GmailConfig): GmailAdapter => {
  switch (config.mode) {
    case "live":
      return new RemoteGmailAdapter({ ...config, baseUrl: "https://gmail.googleapis.com" });
    case "arga":
      return new RemoteGmailAdapter(config);
    case "local_fixture":
      return new FixtureGmailAdapter(config);
  }
};
