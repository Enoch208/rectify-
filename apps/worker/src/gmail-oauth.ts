import { createGmailAdapter, type GmailAdapter } from "@rectify/providers";
import { z } from "zod";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
});

export interface GmailOAuthConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  allowedThreadIds: readonly string[];
}

export class RefreshingGmailAdapter implements GmailAdapter {
  readonly mode = "live" as const;
  readonly #config: GmailOAuthConfig;
  #inner: GmailAdapter | null = null;
  #expiresAt = 0;

  constructor(config: GmailOAuthConfig) {
    this.#config = config;
  }

  async #adapter(): Promise<GmailAdapter> {
    if (this.#inner !== null && Date.now() < this.#expiresAt) {
      return this.#inner;
    }
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.#config.clientId,
        client_secret: this.#config.clientSecret,
        refresh_token: this.#config.refreshToken,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Gmail OAuth refresh failed with HTTP ${String(response.status)}`);
    }
    const token = tokenResponseSchema.parse(await response.json());
    this.#expiresAt = Date.now() + (token.expires_in - 60) * 1_000;
    this.#inner = createGmailAdapter({
      mode: "live",
      accessToken: token.access_token,
      allowedThreadIds: this.#config.allowedThreadIds,
    });
    return this.#inner;
  }

  async readThread(threadId: string) {
    return (await this.#adapter()).readThread(threadId);
  }

  async createDraft(input: { threadId: string; rawMime: string }) {
    return (await this.#adapter()).createDraft(input);
  }

  async getDraftMime(draftId: string) {
    return (await this.#adapter()).getDraftMime(draftId);
  }

  async listDrafts() {
    return (await this.#adapter()).listDrafts();
  }

  async sendDraft(input: { draftId: string; threadId: string; rawMime: string }) {
    return (await this.#adapter()).sendDraft(input);
  }

  async findMessagesByRfc822MessageId(rfc822MessageId: string) {
    return (await this.#adapter()).findMessagesByRfc822MessageId(rfc822MessageId);
  }
}
