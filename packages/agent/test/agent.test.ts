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
  assert.equal(result.telemetry.status, "NOT_CONFIGURED");
  assert.equal(model.doGenerateCalls.length, 1);
});
