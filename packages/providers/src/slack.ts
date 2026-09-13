import type { SlackAdapter } from "./contracts.ts";
import { FixtureSlackAdapter, type SlackFixtureConfig } from "./slack-fixture.ts";
import { RemoteSlackAdapter } from "./slack-remote.ts";

export interface SlackLiveConfig {
  mode: "live";
  accessToken: string;
  channelId: string;
}

export interface SlackArgaConfig {
  mode: "arga";
  accessToken: string;
  baseUrl: string;
  channelId: string;
}

export type SlackConfig = SlackLiveConfig | SlackArgaConfig | SlackFixtureConfig;

export const createSlackAdapter = (config: SlackConfig): SlackAdapter => {
  switch (config.mode) {
    case "live":
      return new RemoteSlackAdapter({ ...config, baseUrl: "https://slack.com" });
    case "arga":
      return new RemoteSlackAdapter(config);
    case "local_fixture":
      return new FixtureSlackAdapter(config);
  }
};
