import { z } from "zod";
import { slackRemoteConfigSchema } from "./config.ts";
import {
  type ProviderMode,
  type SlackAdapter,
  type SlackMessage,
  slackMessageSchema,
  type SlackPostInput,
} from "./contracts.ts";
import { ProviderRequestError } from "./error.ts";
import { providerUrl, requestJson } from "./http.ts";
import { assertSlackLimit, assertSlackPost } from "./slack-input.ts";

export interface SlackRemoteConfig {
  mode: "live" | "arga";
  accessToken: string;
  baseUrl: string;
  channelId: string;
}

const slackErrorSchema = z.object({ ok: z.literal(false), error: z.string().min(1) });
const slackMessagesSchema = z.union([
  z.object({ ok: z.literal(true), messages: z.array(slackMessageSchema) }),
  slackErrorSchema,
]);
const slackPostSchema = z.union([
  z.object({
    ok: z.literal(true),
    channel: z.string().min(1),
    ts: z.string().min(1),
    message: z.object({
      text: z.string(),
      user: z.string().optional(),
      thread_ts: z.string().min(1).optional(),
    }),
  }),
  slackErrorSchema,
]);

export class RemoteSlackAdapter implements SlackAdapter {
  readonly mode: ProviderMode;
  readonly channelId: string;
  readonly #accessToken: string;
  readonly #baseUrl: string;

  constructor(config: SlackRemoteConfig) {
    const parsed = slackRemoteConfigSchema.parse(config);
    this.mode = parsed.mode;
    this.#accessToken = parsed.accessToken;
    this.#baseUrl = parsed.baseUrl;
    this.channelId = parsed.channelId;
  }

  #headers(): Record<string, string> {
    return {
      authorization: `Bearer ${this.#accessToken}`,
      "content-type": "application/json; charset=utf-8",
    };
  }

  async #readConversation(method: string, query: Record<string, string>): Promise<SlackMessage[]> {
    const url = providerUrl(this.#baseUrl, `api/${method}`);
    url.search = new URLSearchParams({ channel: this.channelId, ...query }).toString();
    const result = await requestJson(url, { headers: this.#headers() }, slackMessagesSchema);
    if (!result.ok) {
      throw new ProviderRequestError(`Slack ${method} failed: ${result.error}`);
    }
    return result.messages;
  }

  async readMessages(limit: number): Promise<SlackMessage[]> {
    assertSlackLimit(limit);
    return this.#readConversation("conversations.history", { limit: String(limit) });
  }

  async readReplies(threadTs: string, limit: number): Promise<SlackMessage[]> {
    assertSlackLimit(limit);
    return this.#readConversation("conversations.replies", {
      ts: threadTs,
      limit: String(limit),
    });
  }

  async postMessage(input: SlackPostInput): Promise<SlackMessage> {
    assertSlackPost(input);
    const result = await requestJson(
      providerUrl(this.#baseUrl, "api/chat.postMessage"),
      {
        method: "POST",
        headers: this.#headers(),
        body: JSON.stringify({
          channel: this.channelId,
          text: input.text,
          ...(input.threadTs === undefined ? {} : { thread_ts: input.threadTs }),
          ...(input.blocks === undefined ? {} : { blocks: input.blocks }),
        }),
      },
      slackPostSchema,
    );
    if (!result.ok) {
      throw new ProviderRequestError(`Slack chat.postMessage failed: ${result.error}`);
    }
    return {
      ts: result.ts,
      text: result.message.text,
      ...(result.message.user === undefined ? {} : { user: result.message.user }),
      ...(result.message.thread_ts === undefined ? {} : { thread_ts: result.message.thread_ts }),
    };
  }
}
