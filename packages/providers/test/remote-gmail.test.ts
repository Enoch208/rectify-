import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createGmailAdapter,
  ProviderConfigurationError,
  ProviderRequestError,
} from "../src/index.ts";
import { encode, listen, ok, type Route } from "./server.ts";

const fullThread = {
  id: "thread-1",
  historyId: "99",
  messages: [
    {
      id: "message-1",
      threadId: "thread-1",
      labelIds: ["INBOX"],
      snippet: "Export is empty",
      payload: {
        mimeType: "multipart/mixed",
        headers: [
          { name: "From", value: "Maya <maya@northstar.example>" },
          { name: "To", value: "support@reportdesk.example" },
          { name: "Subject", value: "Empty CSV export" },
          { name: "Date", value: "Mon, 7 Sep 2026 09:00:00 +0000" },
        ],
        body: { size: 0 },
        parts: [
          {
            mimeType: "multipart/alternative",
            parts: [
              { mimeType: "text/html", body: { data: encode("<p>html</p>") } },
              { mimeType: "text/plain", body: { data: encode("The monthly CSV is empty ✓") } },
            ],
          },
          {
            mimeType: "text/plain",
            filename: "notes.txt",
            body: { attachmentId: "att-1", size: 10 },
          },
        ],
      },
    },
    {
      id: "message-2",
      threadId: "thread-1",
      payload: { mimeType: "text/plain", headers: [], body: { data: encode("Single part") } },
    },
    {
      id: "message-3",
      threadId: "thread-1",
      payload: { mimeType: "text/html", headers: [], body: { data: encode("<b>only</b>") } },
    },
  ],
};

const gmailRoute: Route = (request) => {
  const base = "/gmail/v1/users/me";
  if (request.method === "GET" && request.url === `${base}/threads/thread-1?format=full`) {
    return ok(fullThread);
  }
  if (request.method === "GET" && request.url === `${base}/drafts/draft-1?format=raw`) {
    return ok({
      id: "draft-1",
      message: { id: "dm-1", threadId: "thread-1", raw: encode("X-Rectify-Action: k1\r\n\r\nHi") },
    });
  }
  if (request.method === "GET" && request.url === `${base}/drafts/draft-9?format=raw`) {
    return ok({ id: "draft-9", message: { id: "dm-9", threadId: "thread-9", raw: encode("x") } });
  }
  if (request.method === "GET" && request.url === `${base}/drafts?maxResults=50`) {
    return ok({
      drafts: [
        { id: "draft-1", message: { id: "dm-1", threadId: "thread-1" } },
        { id: "draft-9", message: { id: "dm-9", threadId: "thread-9" } },
      ],
      resultSizeEstimate: 2,
    });
  }
  if (request.method === "POST" && request.url === `${base}/drafts/send`) {
    return ok({ id: "sent-1", threadId: "thread-1", labelIds: ["SENT"] });
  }
  if (request.method === "GET" && request.url.startsWith(`${base}/messages?`)) {
    const query = new URL(request.url, "http://local").searchParams.get("q");
    return query === "rfc822msgid:found@rectify.test"
      ? ok({ messages: [{ id: "sent-1", threadId: "thread-1" }], resultSizeEstimate: 1 })
      : ok({ resultSizeEstimate: 0 });
  }
  return undefined;
};

const adapterFor = (baseUrl: string) =>
  createGmailAdapter({
    mode: "arga",
    accessToken: "gmail-twin-token",
    baseUrl,
    allowedThreadIds: ["thread-1"],
  });

void test("remote Gmail decodes full-format threads including nested parts", async () => {
  const server = await listen(gmailRoute);
  try {
    const thread = await adapterFor(server.baseUrl).readThread("thread-1");
    assert.equal(thread.historyId, "99");
    assert.deepEqual(thread.messages, [
      {
        id: "message-1",
        threadId: "thread-1",
        labelIds: ["INBOX"],
        snippet: "Export is empty",
        from: "Maya <maya@northstar.example>",
        to: "support@reportdesk.example",
        subject: "Empty CSV export",
        date: "Mon, 7 Sep 2026 09:00:00 +0000",
        bodyText: "The monthly CSV is empty ✓",
      },
      {
        id: "message-2",
        threadId: "thread-1",
        from: null,
        to: null,
        subject: null,
        date: null,
        bodyText: "Single part",
      },
      {
        id: "message-3",
        threadId: "thread-1",
        from: null,
        to: null,
        subject: null,
        date: null,
        bodyText: null,
      },
    ]);
    assert.equal(server.requests[0]?.authorization, "Bearer gmail-twin-token");
  } finally {
    server.close();
  }
});

void test("remote Gmail reads, lists and sends drafts with documented shapes", async () => {
  const server = await listen(gmailRoute);
  try {
    const gmail = adapterFor(server.baseUrl);
    assert.deepEqual(await gmail.getDraftMime("draft-1"), {
      draftId: "draft-1",
      messageId: "dm-1",
      threadId: "thread-1",
      rawMime: "X-Rectify-Action: k1\r\n\r\nHi",
    });
    await assert.rejects(gmail.getDraftMime("draft-9"), ProviderConfigurationError);
    assert.deepEqual(await gmail.listDrafts(), [
      { draftId: "draft-1", messageId: "dm-1", threadId: "thread-1" },
    ]);
    const sent = await gmail.sendDraft({
      draftId: "draft-1",
      threadId: "thread-1",
      rawMime: "Subject: Fixed\r\n\r\nBody",
    });
    assert.deepEqual(sent, { id: "sent-1", threadId: "thread-1", labelIds: ["SENT"] });
    const sendRequest = server.requests.find((request) => request.url.endsWith("/drafts/send"));
    assert.deepEqual(sendRequest?.body, {
      id: "draft-1",
      message: { raw: encode("Subject: Fixed\r\n\r\nBody"), threadId: "thread-1" },
    });
  } finally {
    server.close();
  }
});

void test("remote Gmail message search handles found and omitted message lists", async () => {
  const server = await listen(gmailRoute);
  try {
    const gmail = adapterFor(server.baseUrl);
    assert.deepEqual(await gmail.findMessagesByRfc822MessageId("<found@rectify.test>"), [
      { id: "sent-1", threadId: "thread-1" },
    ]);
    assert.deepEqual(await gmail.findMessagesByRfc822MessageId("missing@rectify.test"), []);
    const search = new URL(server.requests[0]?.url ?? "", "http://local").searchParams;
    assert.equal(search.get("includeSpamTrash"), "true");
    await assert.rejects(gmail.findMessagesByRfc822MessageId("a b"), ProviderConfigurationError);
  } finally {
    server.close();
  }
});

void test("remote Gmail rejects provider responses that fail validation", async () => {
  const server = await listen(() => ok({ drafts: [{ id: "draft-1" }] }));
  try {
    await assert.rejects(adapterFor(server.baseUrl).listDrafts(), ProviderRequestError);
  } finally {
    server.close();
  }
});
