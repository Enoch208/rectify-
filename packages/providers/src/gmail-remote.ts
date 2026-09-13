import { z } from "zod";
import { gmailRemoteConfigSchema } from "./config.ts";
import {
  type GmailAdapter,
  type GmailDraft,
  type GmailDraftMime,
  type GmailDraftRef,
  gmailDraftSchema,
  type GmailMessageRef,
  gmailMessageRefSchema,
  type GmailThread,
  type ProviderMode,
} from "./contracts.ts";
import { ProviderConfigurationError } from "./error.ts";
import {
  decodeBase64Url,
  encodeBase64Url,
  gmailFullThreadSchema,
  toGmailMessage,
} from "./gmail-payload.ts";
import { providerUrl, requestJson } from "./http.ts";
import { normalizeRfc822MessageId } from "./mime.ts";

export interface GmailRemoteConfig {
  mode: "live" | "arga";
  accessToken: string;
  baseUrl: string;
  userId?: string;
  allowedThreadIds: readonly string[];
}

const rawDraftSchema = z.object({
  id: z.string().min(1),
  message: z.object({
    id: z.string().min(1),
    threadId: z.string().min(1),
    raw: z.string().min(1),
  }),
});

const draftListSchema = z.object({
  drafts: z
    .array(
      z.object({
        id: z.string().min(1),
        message: z.object({ id: z.string().min(1), threadId: z.string().min(1) }),
      }),
    )
    .optional(),
});

const messageListSchema = z.object({
  messages: z.array(gmailMessageRefSchema).optional(),
});

export class RemoteGmailAdapter implements GmailAdapter {
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

  #url(path: string, query: Record<string, string> = {}): URL {
    const url = providerUrl(
      this.#baseUrl,
      `gmail/v1/users/${encodeURIComponent(this.#userId)}/${path}`,
    );
    url.search = new URLSearchParams(query).toString();
    return url;
  }

  #headers(): Record<string, string> {
    return {
      authorization: `Bearer ${this.#accessToken}`,
      "content-type": "application/json",
    };
  }

  async readThread(threadId: string): Promise<GmailThread> {
    this.#assertThreadAllowed(threadId);
    const thread = await requestJson(
      this.#url(`threads/${encodeURIComponent(threadId)}`, { format: "full" }),
      { headers: this.#headers() },
      gmailFullThreadSchema,
    );
    return {
      id: thread.id,
      ...(thread.historyId === undefined ? {} : { historyId: thread.historyId }),
      messages: thread.messages.map(toGmailMessage),
    };
  }

  async createDraft(input: { threadId: string; rawMime: string }): Promise<GmailDraft> {
    this.#assertThreadAllowed(input.threadId);
    return requestJson(
      this.#url("drafts"),
      {
        method: "POST",
        headers: this.#headers(),
        body: JSON.stringify({
          message: { threadId: input.threadId, raw: encodeBase64Url(input.rawMime) },
        }),
      },
      gmailDraftSchema,
    );
  }

  async getDraftMime(draftId: string): Promise<GmailDraftMime> {
    const draft = await requestJson(
      this.#url(`drafts/${encodeURIComponent(draftId)}`, { format: "raw" }),
      { headers: this.#headers() },
      rawDraftSchema,
    );
    this.#assertThreadAllowed(draft.message.threadId);
    return {
      draftId: draft.id,
      messageId: draft.message.id,
      threadId: draft.message.threadId,
      rawMime: decodeBase64Url(draft.message.raw),
    };
  }

  async listDrafts(): Promise<GmailDraftRef[]> {
    const result = await requestJson(
      this.#url("drafts", { maxResults: "50" }),
      { headers: this.#headers() },
      draftListSchema,
    );
    return (result.drafts ?? [])
      .filter((draft) => this.#allowedThreadIds.has(draft.message.threadId))
      .map((draft) => ({
        draftId: draft.id,
        messageId: draft.message.id,
        threadId: draft.message.threadId,
      }));
  }

  async sendDraft(input: {
    draftId: string;
    threadId: string;
    rawMime: string;
  }): Promise<GmailMessageRef> {
    this.#assertThreadAllowed(input.threadId);
    return requestJson(
      this.#url("drafts/send"),
      {
        method: "POST",
        headers: this.#headers(),
        body: JSON.stringify({
          id: input.draftId,
          message: { raw: encodeBase64Url(input.rawMime), threadId: input.threadId },
        }),
      },
      gmailMessageRefSchema,
    );
  }

  async findMessagesByRfc822MessageId(rfc822MessageId: string): Promise<GmailMessageRef[]> {
    const normalized = normalizeRfc822MessageId(rfc822MessageId);
    if (normalized.length === 0 || /\s/u.test(normalized)) {
      throw new ProviderConfigurationError("RFC 822 Message-ID must be a non-empty token");
    }
    const result = await requestJson(
      this.#url("messages", { q: `rfc822msgid:${normalized}`, includeSpamTrash: "true" }),
      { headers: this.#headers() },
      messageListSchema,
    );
    return result.messages ?? [];
  }
}
