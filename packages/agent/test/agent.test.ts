import assert from "node:assert/strict";
import { test } from "node:test";
import { MockLanguageModelV4 } from "ai/test";
import {
  AGENT_TOOL_CALL_LIMIT,
  runBoundedAgentTurn,
  ToolBudget,
  ToolBudgetExceededError,
  type AgentToolHandlers,
} from "../src/index.ts";

const handlers: AgentToolHandlers = {
  getCase: () => Promise.reject(new Error("Unexpected getCase call")),
  readGmailThread: () => Promise.reject(new Error("Unexpected readGmailThread call")),
  listGitHubIssues: () => Promise.reject(new Error("Unexpected listGitHubIssues call")),
  readGitHubIssue: () => Promise.reject(new Error("Unexpected readGitHubIssue call")),
  selectEngineeringIssue: () => Promise.reject(new Error("Unexpected selectEngineeringIssue call")),
  readSlackMessages: () => Promise.reject(new Error("Unexpected readSlackMessages call")),
  verifyCsvExport: () => Promise.reject(new Error("Unexpected verifyCsvExport call")),
  proposeAction: () => Promise.reject(new Error("Unexpected proposeAction call")),
  requestHuman: () => Promise.reject(new Error("Unexpected requestHuman call")),
};

const usage = {
  inputTokens: {
    total: 10,
    noCache: 10,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: {
    total: 5,
    text: 5,
    reasoning: undefined,
  },
};

void test("tool budget stops the twenty-first tool execution", () => {
  const budget = new ToolBudget(AGENT_TOOL_CALL_LIMIT);
  for (let count = 0; count < AGENT_TOOL_CALL_LIMIT; count += 1) {
    budget.consume();
  }

  assert.equal(budget.used, 20);
  assert.throws(() => {
    budget.consume();
  }, ToolBudgetExceededError);
});

void test("bounded turn uses the installed AI SDK v7 result contract", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: "text", text: "The case needs direct verification." }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    },
  });
  const result = await runBoundedAgentTurn({
    model,
    modelId: "mock-model",
    runId: "run-1",
    caseId: "case-1",
    organizationId: "org-1",
    actionId: null,
    promptRevision: "prompt-1",
    releaseId: "release-1",
    environments: {
      gmail: "NOT RUN",
      github: "NOT RUN",
      slack: "NOT RUN",
      reportdesk: "LOCAL FIXTURE",
    },
    redactedPrompt: "Investigate the redacted customer export complaint.",
    handlers,
  });

  assert.equal(result.text, "The case needs direct verification.");
  assert.equal(result.toolCallCount, 0);
  assert.equal(result.stopReason, "MODEL_FINISH");
  assert.equal(result.traceId, null);
  assert.equal(result.telemetry.status, "NOT_CONFIGURED");
  assert.equal(model.doGenerateCalls.length, 1);
});

void test("bounded turn returns the explicit Lemma trace id it delivers", async () => {
  const runId = "65bf4be8-5f88-4ca4-84bd-0c7c7e479b40";
  const payloads: unknown[] = [];
  const model = new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: "text", text: "The case needs direct verification." }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    },
  });
  const result = await runBoundedAgentTurn({
    model,
    modelId: "mock-model",
    runId,
    caseId: "case-1",
    organizationId: "org-1",
    actionId: null,
    promptRevision: "prompt-1",
    releaseId: "release-1",
    environments: {
      gmail: "LOCAL FIXTURE",
      github: "LOCAL FIXTURE",
      slack: "LOCAL FIXTURE",
      reportdesk: "LOCAL FIXTURE",
    },
    redactedPrompt: "Investigate the redacted customer export complaint.",
    handlers,
    lemma: {
      apiKey: "test-key",
      projectId: "0f23d834-e16a-4201-a593-5fc9859f8944",
      release: "test-release",
      fetch: (_input, init) => {
        const requestBody = init?.body;
        assert.ok(typeof requestBody === "string");
        payloads.push(JSON.parse(requestBody) as unknown);
        return Promise.resolve(new Response(null, { status: 201 }));
      },
    },
  });

  assert.equal(result.traceId, runId);
  assert.equal(result.telemetry.status, "DELIVERED");
  assert.equal(payloads.length, 1);
  const payload = payloads[0];
  assert.ok(payload !== null && typeof payload === "object");
  const body = payload as { project_id?: unknown; trace?: unknown };
  assert.equal(body.project_id, "0f23d834-e16a-4201-a593-5fc9859f8944");
  assert.ok(body.trace !== null && typeof body.trace === "object");
  const trace = body.trace as Record<string, unknown>;
  assert.equal(trace.id, runId);
  assert.equal(trace.name, "rectify-recovery-agent");
  assert.equal(trace.input, "Investigate the redacted customer export complaint.");
  assert.equal(trace.output, "The case needs direct verification.");
  assert.equal(trace.thread_id, "case-1");
  assert.equal(trace.user_id, "org-1");
  assert.equal(trace.release, "test-release");
  assert.equal(typeof trace.started_at, "string");
  assert.equal(typeof trace.ended_at, "string");
  assert.ok(Array.isArray(trace.spans));
});
