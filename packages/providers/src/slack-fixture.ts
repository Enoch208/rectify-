import {
  type SlackAdapter,
  type SlackMessage,
  slackMessageSchema,
  type SlackPostInput,
} from "./contracts.ts";
import { ProviderConfigurationError, ProviderRequestError } from "./error.ts";
import { assertSlackLimit, assertSlackPost } from "./slack-input.ts";

export interface SlackFixtureConfig {
  mode: "local_fixture";
  channelId: string;
  messages: readonly SlackMessage[];
}

const isThreadReply = (message: SlackMessage): boolean =>
  message.thread_ts !== undefined && message.thread_ts !== message.ts;

export class FixtureSlackAdapter implements SlackAdapter {
  readonly mode = "local_fixture" as const;
  readonly channelId: string;
  readonly #messages: SlackMessage[];
  readonly #posted: SlackMessage[] = [];
  #sequence = 0;

  constructor(config: SlackFixtureConfig) {
    if (config.channelId.length === 0) {
      throw new ProviderConfigurationError("Slack fixture channel is required");
    }
    this.channelId = config.channelId;
    this.#messages = config.messages.map((message) => slackMessageSchema.parse(message));
  }

  #nextTs(): string {
    this.#sequence += 1;
    const seconds = Math.floor(Date.now() / 1000);
    return `${String(seconds)}.${String(this.#sequence).padStart(6, "0")}`;
  }

  async readMessages(limit: number): Promise<SlackMessage[]> {
    assertSlackLimit(limit);
    const history = this.#messages.filter((message) => !isThreadReply(message));
    return Promise.resolve(history.slice(-limit).reverse());
  }

  async readReplies(threadTs: string, limit: number): Promise<SlackMessage[]> {
    assertSlackLimit(limit);
    const parent = this.#messages.find((message) => message.ts === threadTs);
    if (parent === undefined) {
      throw new ProviderRequestError("Slack conversations.replies failed: thread_not_found");
    }
    const replies = this.#messages.filter(
      (message) => isThreadReply(message) && message.thread_ts === threadTs,
    );
    return Promise.resolve([parent, ...replies].slice(0, limit));
  }

  async postMessage(input: SlackPostInput): Promise<SlackMessage> {
    assertSlackPost(input);
    if (
      input.threadTs !== undefined &&
      !this.#messages.some((message) => message.ts === input.threadTs)
    ) {
      throw new ProviderRequestError("Slack chat.postMessage failed: thread_not_found");
    }
    const message = slackMessageSchema.parse({
      ts: this.#nextTs(),
      text: input.text,
      user: "fixture-bot",
      ...(input.threadTs === undefined ? {} : { thread_ts: input.threadTs }),
    });
    this.#messages.push(message);
    this.#posted.push(message);
    return Promise.resolve({ ...message });
  }

  listPosted(): SlackMessage[] {
    return this.#posted.map((message) => ({ ...message }));
  }
}
