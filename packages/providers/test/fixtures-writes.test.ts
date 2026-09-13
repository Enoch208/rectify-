import assert from "node:assert/strict";
import { test } from "node:test";
import { FixtureGitHubAdapter, FixtureGmailAdapter, FixtureSlackAdapter } from "../src/index.ts";
import { customerMime, fixtureIssue, fixtureMessage } from "./fixture-data.ts";

void test("fixture Gmail stores drafts, sends them into the thread and indexes Message-ID", async () => {
  const gmail = new FixtureGmailAdapter({
    mode: "local_fixture",
    threads: [{ id: "thread-1", messages: [fixtureMessage("message-1", "thread-1")] }],
  });
  const rawMime = customerMime();
  const draft = await gmail.createDraft({ threadId: "thread-1", rawMime });

  assert.deepEqual(await gmail.listDrafts(), [
    { draftId: draft.id, messageId: draft.message.id, threadId: "thread-1" },
  ]);
  assert.equal((await gmail.getDraftMime(draft.id)).rawMime, rawMime);
  await assert.rejects(
    gmail.sendDraft({ draftId: draft.id, threadId: "thread-2", rawMime }),
    /not configured/u,
  );

  const sent = await gmail.sendDraft({ draftId: draft.id, threadId: "thread-1", rawMime });

  assert.deepEqual(await gmail.listDrafts(), []);
  assert.deepEqual(await gmail.findMessagesByRfc822MessageId("<case-1.v1@rectify.test>"), [
    { id: sent.id, threadId: "thread-1", labelIds: ["SENT"] },
  ]);
  assert.deepEqual(await gmail.findMessagesByRfc822MessageId("other@rectify.test"), []);
  assert.deepEqual(gmail.listSentMessages(), [{ id: sent.id, threadId: "thread-1", rawMime }]);
  const thread = await gmail.readThread("thread-1");
  assert.equal(thread.messages.length, 2);
  const reply = thread.messages[1];
  assert.ok(reply);
  assert.equal(reply.subject, "Re: Empty CSV export");
  assert.equal(reply.to, "maya@northstar.example");
  assert.equal(reply.bodyText, "Your export works again.\r\nThanks for your patience.");
  await assert.rejects(
    gmail.sendDraft({ draftId: draft.id, threadId: "thread-1", rawMime }),
    /draft not found/u,
  );
});

void test("fixture GitHub lists issues newest first and records comments", async () => {
  const github = new FixtureGitHubAdapter({
    mode: "local_fixture",
    owner: "rectify",
    repo: "provider-tests",
    issues: [fixtureIssue(1, "closed", null)],
  });
  const created = await github.createIssue({ title: "Impact", body: "Still failing" });
  const comment = await github.createComment(1, "Customer still affected");

  assert.deepEqual(
    (await github.listIssues()).map((issue) => issue.number),
    [2, 1],
  );
  assert.equal(created.html_url, "https://github.local/rectify/provider-tests/issues/2");
  assert.equal(
    comment.html_url,
    "https://github.local/rectify/provider-tests/issues/1#issuecomment-1",
  );
  assert.deepEqual(await github.listComments(1), [comment]);
  assert.deepEqual(await github.listComments(2), []);
  assert.deepEqual(github.listAllComments(), [{ issueNumber: 1, comment }]);
  await assert.rejects(github.createComment(1, ""), /required/u);
});

void test("fixture Slack keeps thread replies out of history and records posts", async () => {
  const slack = new FixtureSlackAdapter({
    mode: "local_fixture",
    channelId: "channel-1",
    messages: [{ ts: "1.000000", text: "Rollout complete" }],
  });
  const parent = await slack.postMessage({ text: "Handoff" });
  const reply = await slack.postMessage({ text: "Approved", threadTs: parent.ts });

  assert.equal(reply.thread_ts, parent.ts);
  assert.notEqual(reply.ts, parent.ts);
  assert.deepEqual(
    (await slack.readMessages(10)).map((message) => message.text),
    ["Handoff", "Rollout complete"],
  );
  assert.deepEqual(
    (await slack.readReplies(parent.ts, 10)).map((message) => message.text),
    ["Handoff", "Approved"],
  );
  assert.deepEqual(slack.listPosted(), [parent, reply]);
});
