import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import {
  createGitHubAdapter,
  createGmailAdapter,
  createSlackAdapter,
  ProviderRequestError,
} from "../src/index.ts";

const send = (response: ServerResponse, status: number, payload: unknown): void => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
};

const providerResponse = (request: IncomingMessage, response: ServerResponse): void => {
  const path = request.url ?? "";
  if (request.method === "GET" && path.startsWith("/gmail/v1/users/me/threads/thread-1")) {
    send(response, 200, { id: "thread-1", messages: [{ id: "message-1", threadId: "thread-1" }] });
    return;
  }
  if (request.method === "POST" && path === "/gmail/v1/users/me/drafts") {
    send(response, 200, {
      id: "draft-1",
      message: { id: "draft-message-1", threadId: "thread-1", labelIds: ["DRAFT"] },
    });
    return;
  }
  if (request.method === "GET" && path === "/repos/rectify/app/issues/7") {
    send(response, 200, {
      id: 7,
      number: 7,
      title: "Closed fix",
      body: "Merged",
      state: "closed",
      html_url: "https://github.example/rectify/app/issues/7",
    });
    return;
  }
  if (request.method === "POST" && path === "/repos/rectify/app/issues") {
    send(response, 201, {
      id: 8,
      number: 8,
      title: "Customer impact",
      body: "Still failing",
      state: "open",
      html_url: "https://github.example/rectify/app/issues/8",
    });
    return;
  }
  if (request.method === "GET" && path === "/api/conversations.history?channel=C123&limit=1") {
    send(response, 200, { ok: true, messages: [{ ts: "1.000000", text: "Rollout complete" }] });
    return;
  }
  if (request.method === "POST" && path === "/api/chat.postMessage") {
    send(response, 200, {
      ok: true,
      channel: "C123",
      ts: "2.000000",
      message: { ts: "2.000000", text: "Customer still affected" },
    });
    return;
  }
  send(response, 404, { error: "unexpected request" });
};

const listen = async (
  handler = providerResponse,
): Promise<{ baseUrl: string; close: () => void }> => {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${String(address.port)}`,
    close: () => {
      server.closeAllConnections();
      server.close();
    },
  };
};

void test("Arga adapters use the documented provider-shaped read and write endpoints", async () => {
  const server = await listen();
  try {
    const gmail = createGmailAdapter({
      mode: "arga",
      accessToken: "gmail-twin-token",
      baseUrl: server.baseUrl,
      allowedThreadIds: ["thread-1"],
    });
    const github = createGitHubAdapter({
      mode: "arga",
      accessToken: "github-twin-token",
      baseUrl: server.baseUrl,
      owner: "rectify",
      repo: "app",
    });
    const slack = createSlackAdapter({
      mode: "arga",
      accessToken: "slack-twin-token",
      baseUrl: server.baseUrl,
      channelId: "C123",
    });

    assert.equal((await gmail.readThread("thread-1")).id, "thread-1");
    assert.equal(
      (await gmail.createDraft({ threadId: "thread-1", rawMime: "Subject: Retry" })).id,
      "draft-1",
    );
    assert.equal((await github.readIssue(7)).state, "closed");
    assert.equal((await github.createIssue({ title: "Impact", body: "Failure" })).number, 8);
    assert.equal((await slack.readMessages(1))[0]?.text, "Rollout complete");
    assert.equal((await slack.postMessage("Customer still affected")).ts, "2.000000");
  } finally {
    server.close();
  }
});

void test("remote provider errors surface without a fixture fallback", async () => {
  const server = await listen((_request, response) => {
    send(response, 503, { error: "provider unavailable" });
  });
  try {
    const github = createGitHubAdapter({
      mode: "arga",
      accessToken: "github-twin-token",
      baseUrl: server.baseUrl,
      owner: "rectify",
      repo: "app",
    });

    await assert.rejects(github.readIssue(7), ProviderRequestError);
  } finally {
    server.close();
  }
});
