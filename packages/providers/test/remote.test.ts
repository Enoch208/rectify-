import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createGitHubAdapter,
  createGmailAdapter,
  createSlackAdapter,
  ProviderConfigurationError,
  ProviderRequestError,
} from "../src/index.ts";
import { listen, ok, type Route } from "./server.ts";

const issue = (number: number, state: "open" | "closed") => ({
  id: number,
  number,
  title: "Closed fix",
  body: "Merged",
  state,
  html_url: `https://github.example/rectify/app/issues/${String(number)}`,
  labels: [{ id: 1, name: "bug" }],
  updated_at: "2026-09-01T00:00:00Z",
});

const providerRoute: Route = (request) => {
  if (request.method === "GET" && request.url.startsWith("/gmail/v1/users/me/threads/thread-1")) {
    return ok({ id: "thread-1", messages: [] });
  }
  if (request.method === "POST" && request.url === "/gmail/v1/users/me/drafts") {
    return ok({ id: "draft-1", message: { id: "draft-message-1", threadId: "thread-1" } });
  }
  if (request.method === "GET" && request.url === "/repos/rectify/app/issues/7") {
    return ok(issue(7, "closed"));
  }
  if (request.method === "POST" && request.url === "/repos/rectify/app/issues") {
    return { status: 201, payload: issue(8, "open") };
  }
  if (
    request.method === "GET" &&
    request.url === "/api/conversations.history?channel=C123&limit=1"
  ) {
    return ok({ ok: true, messages: [{ ts: "1.000000", text: "Rollout complete" }] });
  }
  if (request.method === "POST" && request.url === "/api/chat.postMessage") {
    return ok({ ok: true, channel: "C123", ts: "2.000000", message: { text: "Still affected" } });
  }
  return undefined;
};

void test("Arga adapters use the documented provider-shaped read and write endpoints", async () => {
  const server = await listen(providerRoute);
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
    const sourceIssue = await github.readIssue(7);
    assert.equal(sourceIssue.state, "closed");
    assert.deepEqual(sourceIssue.labels, ["bug"]);
    assert.equal((await github.createIssue({ title: "Impact", body: "Failure" })).number, 8);
    assert.equal((await slack.readMessages(1))[0]?.text, "Rollout complete");
    assert.equal((await slack.postMessage({ text: "Still affected" })).ts, "2.000000");
    assert.equal(slack.channelId, "C123");
    assert.equal(server.requests[0]?.url, "/gmail/v1/users/me/threads/thread-1?format=full");
  } finally {
    server.close();
  }
});

void test("remote provider errors surface without a fixture fallback", async () => {
  const server = await listen(() => ({ status: 503, payload: { error: "provider unavailable" } }));
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

void test("remote Gmail refuses threads outside the allowlist before any request", async () => {
  const server = await listen(providerRoute);
  try {
    const gmail = createGmailAdapter({
      mode: "arga",
      accessToken: "gmail-twin-token",
      baseUrl: server.baseUrl,
      allowedThreadIds: ["thread-1"],
    });

    await assert.rejects(gmail.readThread("thread-2"), ProviderConfigurationError);
    await assert.rejects(
      gmail.sendDraft({ draftId: "draft-1", threadId: "thread-2", rawMime: "Subject: x" }),
      ProviderConfigurationError,
    );
    assert.equal(server.requests.length, 0);
  } finally {
    server.close();
  }
});
