import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createGitHubAdapter,
  createGmailAdapter,
  createSlackAdapter,
  providerEnvironmentByMode,
} from "../src/index.ts";
import { fixtureIssue, fixtureMessage } from "./fixture-data.ts";

void test("local fixture adapters remain explicitly labelled and stateful", async () => {
  const gmail = createGmailAdapter({
    mode: "local_fixture",
    threads: [{ id: "thread-1", messages: [fixtureMessage("message-1", "thread-1")] }],
  });
  const github = createGitHubAdapter({
    mode: "local_fixture",
    owner: "rectify",
    repo: "provider-tests",
    issues: [fixtureIssue(1, "closed", "Fixture source")],
  });
  const slack = createSlackAdapter({
    mode: "local_fixture",
    channelId: "channel-1",
    messages: [{ ts: "1.000000", text: "Source message" }],
  });

  const thread = await gmail.readThread("thread-1");
  const draft = await gmail.createDraft({ threadId: "thread-1", rawMime: "Subject: Test" });
  const sourceIssue = await github.readIssue(1);
  const createdIssue = await github.createIssue({ title: "Impact", body: "Observed failure" });
  const message = await slack.postMessage({ text: "Engineering handoff" });
  const messages = await slack.readMessages(2);

  assert.equal(providerEnvironmentByMode[gmail.mode], "LOCAL FIXTURE");
  assert.equal(thread.id, "thread-1");
  assert.equal(draft.message.threadId, "thread-1");
  assert.equal(sourceIssue.state, "closed");
  assert.equal(createdIssue.number, 2);
  assert.deepEqual(createdIssue.labels, []);
  assert.equal(message.text, "Engineering handoff");
  assert.equal(messages.length, 2);
  assert.equal(slack.channelId, "channel-1");
});

void test("fixture adapters reject records outside their configured scope", async () => {
  const gmail = createGmailAdapter({ mode: "local_fixture", threads: [] });
  const github = createGitHubAdapter({
    mode: "local_fixture",
    owner: "rectify",
    repo: "provider-tests",
    issues: [],
  });
  const slack = createSlackAdapter({ mode: "local_fixture", channelId: "channel-1", messages: [] });

  await assert.rejects(gmail.readThread("missing"), /not configured/u);
  await assert.rejects(gmail.getDraftMime("missing"), /not found/u);
  await assert.rejects(github.readIssue(42), /not configured/u);
  await assert.rejects(github.createComment(42, "Body"), /not configured/u);
  await assert.rejects(slack.readReplies("9.000000", 10), /thread_not_found/u);
  await assert.rejects(slack.postMessage({ text: "x", threadTs: "9.000000" }), /thread_not_found/u);
});
