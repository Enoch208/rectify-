import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FixtureGitHubAdapter,
  FixtureGmailAdapter,
  FixtureSlackAdapter,
  reconcileGitHubComment,
  reconcileGitHubIssue,
  reconcileGmailDraft,
  reconcileGmailSend,
  reconcileSlackMessage,
  rectifyMarker,
} from "../src/index.ts";
import { customerMime, fixtureIssue, fixtureMessage } from "./fixture-data.ts";

const key = "case-1:github-issue:v1";
const unresolved = (reason: string) => ({ outcome: "UNRESOLVED", reason });

const github = () =>
  new FixtureGitHubAdapter({
    mode: "local_fixture",
    owner: "rectify",
    repo: "provider-tests",
    issues: [fixtureIssue(1, "closed", null), fixtureIssue(2, "open", "unrelated")],
  });

const gmail = () =>
  new FixtureGmailAdapter({
    mode: "local_fixture",
    threads: [{ id: "thread-1", messages: [fixtureMessage("message-1", "thread-1")] }],
  });

const slack = () =>
  new FixtureSlackAdapter({
    mode: "local_fixture",
    channelId: "channel-1",
    messages: [{ ts: "1.000000", text: "Parent" }],
  });

void test("rectifyMarker embeds the logical key", () => {
  assert.equal(rectifyMarker(key), "rectify-action:case-1:github-issue:v1");
});

void test("reconcileGitHubIssue confirms one marker and refuses zero or duplicates", async () => {
  const adapter = github();
  assert.deepEqual(
    await reconcileGitHubIssue(adapter, key),
    unresolved("No issue carries the action marker"),
  );
  const issue = await adapter.createIssue({ title: "Impact", body: `Body\n${rectifyMarker(key)}` });
  assert.deepEqual(await reconcileGitHubIssue(adapter, key), {
    outcome: "CONFIRMED",
    providerIds: [String(issue.number), issue.html_url],
  });
  await adapter.createIssue({ title: "Impact again", body: rectifyMarker(key) });
  assert.deepEqual(
    await reconcileGitHubIssue(adapter, key),
    unresolved("Multiple issues carry the action marker"),
  );
});

void test("reconcileGitHubComment confirms one marker and refuses zero or duplicates", async () => {
  const adapter = github();
  assert.equal((await reconcileGitHubComment(adapter, 1, key)).outcome, "UNRESOLVED");
  const comment = await adapter.createComment(1, `Handoff ${rectifyMarker(key)}`);
  await adapter.createComment(2, `Elsewhere ${rectifyMarker(key)}`);
  assert.deepEqual(await reconcileGitHubComment(adapter, 1, key), {
    outcome: "CONFIRMED",
    providerIds: [String(comment.id), comment.html_url],
  });
  await adapter.createComment(1, `Retry ${rectifyMarker(key)}`);
  assert.deepEqual(
    await reconcileGitHubComment(adapter, 1, key),
    unresolved("Multiple comments carry the action marker"),
  );
});

void test("reconcileSlackMessage checks channel history or the given thread", async () => {
  const adapter = slack();
  assert.equal((await reconcileSlackMessage(adapter, key, null)).outcome, "UNRESOLVED");
  assert.equal((await reconcileSlackMessage(adapter, key, "1.000000")).outcome, "UNRESOLVED");
  const top = await adapter.postMessage({ text: `Handoff ${rectifyMarker(key)}` });
  const reply = await adapter.postMessage({ text: rectifyMarker(key), threadTs: "1.000000" });
  assert.deepEqual(await reconcileSlackMessage(adapter, key, null), {
    outcome: "CONFIRMED",
    providerIds: [top.ts],
  });
  assert.deepEqual(await reconcileSlackMessage(adapter, key, "1.000000"), {
    outcome: "CONFIRMED",
    providerIds: [reply.ts],
  });
  await adapter.postMessage({ text: rectifyMarker(key) });
  assert.deepEqual(
    await reconcileSlackMessage(adapter, key, null),
    unresolved("Multiple Slack messages carry the action marker"),
  );
});

void test("reconcileGmailDraft matches the exact action header only", async () => {
  const adapter = gmail();
  const logicalKey = "case-1:send-customer-reply:v1";
  assert.equal((await reconcileGmailDraft(adapter, logicalKey)).outcome, "UNRESOLVED");
  await adapter.createDraft({
    threadId: "thread-1",
    rawMime: customerMime({ logicalKey: `${logicalKey}-other` }),
  });
  const draft = await adapter.createDraft({ threadId: "thread-1", rawMime: customerMime() });
  assert.deepEqual(await reconcileGmailDraft(adapter, logicalKey), {
    outcome: "CONFIRMED",
    providerIds: [draft.id, draft.message.id],
  });
  await adapter.createDraft({ threadId: "thread-1", rawMime: customerMime() });
  assert.deepEqual(
    await reconcileGmailDraft(adapter, logicalKey),
    unresolved("Multiple drafts carry the action header"),
  );
});

void test("reconcileGmailSend never treats absence as proof the send did not happen", async () => {
  const adapter = gmail();
  const messageId = "case-1.v1@rectify.test";
  assert.deepEqual(
    await reconcileGmailSend(adapter, messageId),
    unresolved("No sent message found; absence is not proof the send did not happen"),
  );
  const rawMime = customerMime();
  const first = await adapter.createDraft({ threadId: "thread-1", rawMime });
  const sent = await adapter.sendDraft({ draftId: first.id, threadId: "thread-1", rawMime });
  assert.deepEqual(await reconcileGmailSend(adapter, messageId), {
    outcome: "CONFIRMED",
    providerIds: [sent.id],
  });
  const second = await adapter.createDraft({ threadId: "thread-1", rawMime });
  await adapter.sendDraft({ draftId: second.id, threadId: "thread-1", rawMime });
  assert.deepEqual(
    await reconcileGmailSend(adapter, messageId),
    unresolved("Multiple messages carry the Message-ID"),
  );
});
