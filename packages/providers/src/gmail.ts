import { gmailRemoteConfigSchema } from "./config.ts";
import {
  type GmailAdapter,
  type GmailDraft,
  gmailDraftSchema,
  type GmailThread,
  gmailThreadSchema,
  type ProviderMode,
} from "./contracts.ts";
import { ProviderConfigurationError } from "./error.ts";
import { providerUrl, requestJson } from "./http.ts";

interface GmailRemoteConfig {
  mode: "live" | "arga";
  accessToken: string;
  baseUrl: string;
  userId?: string;
  allowedThreadIds: readonly string[];
}

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

export interface GmailFixtureConfig {
  mode: "local_fixture";
  threads: readonly GmailThread[];
}

export type GmailConfig = GmailLiveConfig | GmailArgaConfig | GmailFixtureConfig;

class RemoteGmailAdapter implements GmailAdapter {
  readonly mode: ProviderMode;
  readonly #accessToken: string;
  readonly #baseUrl: string;
  readonly #userId: string;
  readonly #allowedThreadIds: ReadonlySet<string>;

  constructor(config: GmailRemoteConfig) {
    const parsed = gmailRemoteConfigSchema.parse(config);
    this.mode = parsed.mode;
    this.#accessToken = parsed.accessToken;
    this.#baseUrl = parsed.baseUrl;
    this.#userId = parsed.userId;
    this.#allowedThreadIds = new Set(parsed.allowedThreadIds);
  }

  #assertThreadAllowed(threadId: string): void {
    if (!this.#allowedThreadIds.has(threadId)) {
      throw new ProviderConfigurationError(`Gmail thread is outside the allowlist: ${threadId}`);
    }
  }

  async readThread(threadId: string): Promise<GmailThread> {
    this.#assertThreadAllowed(threadId);
    const path = `gmail/v1/users/${encodeURIComponent(this.#userId)}/threads/${encodeURIComponent(threadId)}?format=metadata`;
    return requestJson(
      providerUrl(this.#baseUrl, path),
      { headers: { authorization: `Bearer ${this.#accessToken}` } },
      gmailThreadSchema,
    );
  }

  async createDraft(input: { threadId: string; rawMime: string }): Promise<GmailDraft> {
    this.#assertThreadAllowed(input.threadId);
    const path = `gmail/v1/users/${encodeURIComponent(this.#userId)}/drafts`;
    return requestJson(
      providerUrl(this.#baseUrl, path),
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.#accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: {
            threadId: input.threadId,
            raw: Buffer.from(input.rawMime).toString("base64url"),
          },
        }),
      },
      gmailDraftSchema,
    );
  }
}

class FixtureGmailAdapter implements GmailAdapter {
  readonly mode = "local_fixture" as const;
  readonly #threads = new Map<string, GmailThread>();
  #draftNumber = 0;

  constructor(config: GmailFixtureConfig) {
    for (const thread of config.threads) {
      const parsed = gmailThreadSchema.parse(thread);
      this.#threads.set(parsed.id, parsed);
    }
  }

  async readThread(threadId: string): Promise<GmailThread> {
    const thread = this.#threads.get(threadId);
    if (thread === undefined) {
      throw new ProviderConfigurationError(`Gmail fixture thread is not configured: ${threadId}`);
    }
    return Promise.resolve(thread);
  }

  async createDraft(input: { threadId: string; rawMime: string }): Promise<GmailDraft> {
    await this.readThread(input.threadId);
    if (input.rawMime.length === 0) {
      throw new ProviderConfigurationError("Gmail draft MIME cannot be empty");
    }
    this.#draftNumber += 1;
    return gmailDraftSchema.parse({
      id: `fixture-draft-${String(this.#draftNumber)}`,
      message: {
        id: `fixture-message-${String(this.#draftNumber)}`,
        threadId: input.threadId,
        labelIds: ["DRAFT"],
      },
    });
  }
}

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
