import {
  type GmailAdapter,
  type GmailDraft,
  type GmailDraftMime,
  type GmailDraftRef,
  type GmailMessage,
  type GmailMessageRef,
  type GmailThread,
  gmailThreadSchema,
} from "./contracts.ts";
import { ProviderConfigurationError, ProviderRequestError } from "./error.ts";
import { normalizeRfc822MessageId, parseMimeBody, parseMimeHeaders } from "./mime.ts";

export interface GmailFixtureConfig {
  mode: "local_fixture";
  threads: readonly GmailThread[];
}

export interface FixtureSentMessage {
  id: string;
  threadId: string;
  rawMime: string;
}

const sentToMessage = (sent: FixtureSentMessage): GmailMessage => {
  const headers = parseMimeHeaders(sent.rawMime);
  return {
    id: sent.id,
    threadId: sent.threadId,
    labelIds: ["SENT"],
    from: headers.from ?? null,
    to: headers.to ?? null,
    subject: headers.subject ?? null,
    date: headers.date ?? null,
    bodyText: parseMimeBody(sent.rawMime),
  };
};

export class FixtureGmailAdapter implements GmailAdapter {
  readonly mode = "local_fixture" as const;
  readonly #threads = new Map<string, GmailThread>();
  readonly #drafts = new Map<string, { messageId: string; threadId: string; rawMime: string }>();
  readonly #sent: FixtureSentMessage[] = [];
  readonly #sentByRfc822MessageId = new Map<string, FixtureSentMessage[]>();
  #draftNumber = 0;
  #sentNumber = 0;

  constructor(config: GmailFixtureConfig) {
    for (const thread of config.threads) {
      const parsed = gmailThreadSchema.parse(thread);
      this.#threads.set(parsed.id, parsed);
    }
  }

  #requireThread(threadId: string): GmailThread {
    const thread = this.#threads.get(threadId);
    if (thread === undefined) {
      throw new ProviderConfigurationError(`Gmail fixture thread is not configured: ${threadId}`);
    }
    return thread;
  }

  #requireDraft(draftId: string): { messageId: string; threadId: string; rawMime: string } {
    const draft = this.#drafts.get(draftId);
    if (draft === undefined) {
      throw new ProviderRequestError(`Gmail fixture draft not found: ${draftId}`, 404);
    }
    return draft;
  }

  async readThread(threadId: string): Promise<GmailThread> {
    const thread = this.#requireThread(threadId);
    const sent = this.#sent.filter((message) => message.threadId === threadId).map(sentToMessage);
    return Promise.resolve({ ...thread, messages: [...thread.messages, ...sent] });
  }

  async createDraft(input: { threadId: string; rawMime: string }): Promise<GmailDraft> {
    this.#requireThread(input.threadId);
    if (input.rawMime.length === 0) {
      throw new ProviderConfigurationError("Gmail draft MIME cannot be empty");
    }
    this.#draftNumber += 1;
    const draftId = `fixture-draft-${String(this.#draftNumber)}`;
    const messageId = `fixture-message-${String(this.#draftNumber)}`;
    this.#drafts.set(draftId, { messageId, threadId: input.threadId, rawMime: input.rawMime });
    return Promise.resolve({
      id: draftId,
      message: { id: messageId, threadId: input.threadId, labelIds: ["DRAFT"] },
    });
  }

  async getDraftMime(draftId: string): Promise<GmailDraftMime> {
    const draft = this.#requireDraft(draftId);
    return Promise.resolve({ draftId, ...draft });
  }

  async listDrafts(): Promise<GmailDraftRef[]> {
    return Promise.resolve(
      [...this.#drafts.entries()].map(([draftId, draft]) => ({
        draftId,
        messageId: draft.messageId,
        threadId: draft.threadId,
      })),
    );
  }

  async sendDraft(input: {
    draftId: string;
    threadId: string;
    rawMime: string;
  }): Promise<GmailMessageRef> {
    this.#requireThread(input.threadId);
    const draft = this.#requireDraft(input.draftId);
    if (draft.threadId !== input.threadId) {
      throw new ProviderConfigurationError(
        `Gmail fixture draft ${input.draftId} belongs to thread ${draft.threadId}`,
      );
    }
    if (input.rawMime.length === 0) {
      throw new ProviderConfigurationError("Gmail send MIME cannot be empty");
    }
    this.#drafts.delete(input.draftId);
    this.#sentNumber += 1;
    const sent = {
      id: `fixture-sent-${String(this.#sentNumber)}`,
      threadId: input.threadId,
      rawMime: input.rawMime,
    };
    this.#sent.push(sent);
    const rfc822MessageId = parseMimeHeaders(input.rawMime)["message-id"];
    if (rfc822MessageId !== undefined) {
      const key = normalizeRfc822MessageId(rfc822MessageId);
      this.#sentByRfc822MessageId.set(key, [...(this.#sentByRfc822MessageId.get(key) ?? []), sent]);
    }
    return Promise.resolve({ id: sent.id, threadId: sent.threadId, labelIds: ["SENT"] });
  }

  async findMessagesByRfc822MessageId(rfc822MessageId: string): Promise<GmailMessageRef[]> {
    const matches = this.#sentByRfc822MessageId.get(normalizeRfc822MessageId(rfc822MessageId));
    return Promise.resolve(
      (matches ?? []).map((sent) => ({ id: sent.id, threadId: sent.threadId, labelIds: ["SENT"] })),
    );
  }

  listSentMessages(): FixtureSentMessage[] {
    return this.#sent.map((sent) => ({ ...sent }));
  }
}
