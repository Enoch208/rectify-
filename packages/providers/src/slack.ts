import { z } from "zod";
import { slackRemoteConfigSchema } from "./config.ts";
import {
  type ProviderMode,
  type SlackAdapter,
  type SlackMessage,
  slackMessageSchema,
} from "./contracts.ts";
import { ProviderConfigurationError, ProviderRequestError } from "./error.ts";
import { providerUrl, requestJson } from "./http.ts";

const slackErrorSchema = z.object({ ok: z.literal(false), error: z.string().min(1) });
const slackHistorySchema = z.union([
  z.object({ ok: z.literal(true), messages: z.array(slackMessageSchema) }),
  slackErrorSchema,
]);
const slackPostSchema = z.union([
  z.object({
    ok: z.literal(true),
    channel: z.string().min(1),
    ts: z.string().min(1),
    message: slackMessageSchema,
  }),
  slackErrorSchema,
]);

interface SlackRemoteConfig {
  mode: "live" | "arga";
  accessToken: string;
  baseUrl: string;
  channelId: string;
}

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

export interface SlackFixtureConfig {
  mode: "local_fixture";
  channelId: string;
  messages: readonly SlackMessage[];
}

export type SlackConfig = SlackLiveConfig | SlackArgaConfig | SlackFixtureConfig;

class RemoteSlackAdapter implements SlackAdapter {
  readonly mode: ProviderMode;
  readonly #accessToken: string;
  readonly #baseUrl: string;
  readonly #channelId: string;

  constructor(config: SlackRemoteConfig) {
    const parsed = slackRemoteConfigSchema.parse(config);
    this.mode = parsed.mode;
    this.#accessToken = parsed.accessToken;
    this.#baseUrl = parsed.baseUrl;
    this.#channelId = parsed.channelId;
  }

  #headers(): Record<string, string> {
    return {
      authorization: `Bearer ${this.#accessToken}`,
      "content-type": "application/json; charset=utf-8",
    };
  }

  async readMessages(limit: number): Promise<SlackMessage[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new ProviderConfigurationError("Slack message limit must be between 1 and 100");
    }
    const url = providerUrl(this.#baseUrl, "api/conversations.history");
    url.search = new URLSearchParams({ channel: this.#channelId, limit: String(limit) }).toString();
    const result = await requestJson(url, { headers: this.#headers() }, slackHistorySchema);
    if (!result.ok) {
      throw new ProviderRequestError(`Slack conversations.history failed: ${result.error}`);
    }
    return result.messages;
  }

  async postMessage(text: string): Promise<SlackMessage> {
    if (text.length === 0) {
      throw new ProviderConfigurationError("Slack message text cannot be empty");
    }
    const result = await requestJson(
      providerUrl(this.#baseUrl, "api/chat.postMessage"),
      {
        method: "POST",
        headers: this.#headers(),
        body: JSON.stringify({ channel: this.#channelId, text }),
      },
      slackPostSchema,
    );
    if (!result.ok) {
      throw new ProviderRequestError(`Slack chat.postMessage failed: ${result.error}`);
    }
    return result.message;
  }
}

class FixtureSlackAdapter implements SlackAdapter {
  readonly mode = "local_fixture" as const;
  readonly #messages: SlackMessage[];

  constructor(config: SlackFixtureConfig) {
    if (config.channelId.length === 0) {
      throw new ProviderConfigurationError("Slack fixture channel is required");
    }
    this.#messages = config.messages.map((message) => slackMessageSchema.parse(message));
  }

  async readMessages(limit: number): Promise<SlackMessage[]> {
    return Promise.resolve(this.#messages.slice(-limit).reverse());
  }

  postMessage(text: string): Promise<SlackMessage> {
    const message = slackMessageSchema.parse({
      ts: `${String(Date.now())}.000000`,
      text,
      user: "fixture-bot",
    });
    this.#messages.push(message);
    return Promise.resolve(message);
  }
}

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
