import assert from "node:assert/strict";
import { test } from "node:test";
import { createGitHubAdapter, createSlackAdapter, ProviderRequestError } from "../src/index.ts";
import { listen, ok, type Route } from "./server.ts";

const issue = (number: number, extra: Record<string, unknown> = {}) => ({
  id: 100 + number,
  number,
  title: `Issue ${String(number)}`,
  body: null,
  state: "open",
  html_url: `https://github.example/rectify/app/issues/${String(number)}`,
  labels: [{ name: "customer-impact", color: "f00" }, "legacy-label"],
  updated_at: "2026-09-02T00:00:00Z",
  ...extra,
});

const comment = (id: number, body: string) => ({
  id,
  body,
  html_url: `https://github.example/rectify/app/issues/3#issuecomment-${String(id)}`,
  created_at: "2026-09-03T00:00:00Z",
});

const route: Route = (request) => {
  const issues = "/repos/rectify/app/issues";
  if (request.method === "GET" && request.url.startsWith(`${issues}?`)) {
    return ok([
      issue(3),
      issue(2, { pull_request: { url: "https://pr" } }),
      issue(1, { labels: [] }),
    ]);
  }
  if (request.method === "POST" && request.url === `${issues}/3/comments`) {
    return { status: 201, payload: comment(55, "Handoff") };
  }
  if (request.method === "GET" && request.url === `${issues}/3/comments?per_page=100`) {
    return ok([comment(55, "Handoff"), comment(56, "Fixed")]);
  }
  if (request.method === "GET" && request.url.startsWith("/api/conversations.replies?")) {
    return ok({
      ok: true,
      has_more: false,
      messages: [
        { type: "message", ts: "10.000100", thread_ts: "10.000100", text: "Parent" },
        { type: "message", ts: "11.000100", thread_ts: "10.000100", text: "Reply", user: "U1" },
      ],
    });
  }
  if (request.method === "POST" && request.url === "/api/chat.postMessage") {
    const body = request.body as { thread_ts?: string };
    return body.thread_ts === "missing"
      ? ok({ ok: false, error: "thread_not_found" })
      : ok({
          ok: true,
          channel: "C123",
          ts: "12.000100",
          message: { text: "Approve?", user: "UBOT", thread_ts: "10.000100" },
        });
  }
  return undefined;
};

void test("remote GitHub lists issues without pull requests and maps labels", async () => {
  const server = await listen(route);
  try {
    const github = createGitHubAdapter({
      mode: "arga",
      accessToken: "github-twin-token",
      baseUrl: server.baseUrl,
      owner: "rectify",
      repo: "app",
    });
    const issues = await github.listIssues();
    assert.deepEqual(
      issues.map((entry) => entry.number),
      [3, 1],
    );
    const [newest, oldest] = issues;
    assert.ok(newest && oldest);
    assert.deepEqual(newest.labels, ["customer-impact", "legacy-label"]);
    assert.deepEqual(oldest.labels, []);
    assert.equal(newest.updated_at, "2026-09-02T00:00:00Z");
    const query = new URL(server.requests[0]?.url ?? "", "http://local").searchParams;
    assert.deepEqual(Object.fromEntries(query), {
      state: "all",
      per_page: "50",
      sort: "created",
      direction: "desc",
    });

    const created = await github.createComment(3, "Handoff");
    assert.equal(created.id, 55);
    assert.deepEqual(server.requests[1]?.body, { body: "Handoff" });
    const comments = await github.listComments(3);
    assert.deepEqual(
      comments.map((entry) => entry.body),
      ["Handoff", "Fixed"],
    );
  } finally {
    server.close();
  }
});

void test("remote Slack reads thread replies and posts threaded block messages", async () => {
  const server = await listen(route);
  try {
    const slack = createSlackAdapter({
      mode: "arga",
      accessToken: "slack-twin-token",
      baseUrl: server.baseUrl,
      channelId: "C123",
    });
    const replies = await slack.readReplies("10.000100", 20);
    assert.deepEqual(
      replies.map((message) => message.text),
      ["Parent", "Reply"],
    );
    assert.equal(replies[1]?.thread_ts, "10.000100");
    const query = new URL(server.requests[0]?.url ?? "", "http://local").searchParams;
    assert.deepEqual(Object.fromEntries(query), { channel: "C123", ts: "10.000100", limit: "20" });

    const blocks = [{ type: "section", text: { type: "mrkdwn", text: "Approve?" } }];
    const posted = await slack.postMessage({ text: "Approve?", threadTs: "10.000100", blocks });
    assert.deepEqual(posted, {
      ts: "12.000100",
      text: "Approve?",
      user: "UBOT",
      thread_ts: "10.000100",
    });
    assert.deepEqual(server.requests[1]?.body, {
      channel: "C123",
      text: "Approve?",
      thread_ts: "10.000100",
      blocks,
    });
    await assert.rejects(
      slack.postMessage({ text: "Lost", threadTs: "missing" }),
      ProviderRequestError,
    );
  } finally {
    server.close();
  }
});
