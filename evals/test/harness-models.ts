import { demoThreadId } from "@rectify/worker";
import { MockLanguageModelV4 } from "ai/test";
import type { HarnessModel } from "../src/harness/environment.ts";

export const outcomeSecret = "harness-test-outcome-secret";

const usage = {
  inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

type Call = readonly [toolName: string, input: Record<string, unknown>];

const scriptedModel = (steps: readonly (readonly Call[])[], finalText: string) => {
  let counter = 0;
  return new MockLanguageModelV4({
    doGenerate: [
      ...steps.map((calls) => ({
        content: calls.map(([toolName, input]) => ({
          type: "tool-call" as const,
          toolCallId: `call-${String((counter += 1))}`,
          toolName,
          input: JSON.stringify(input),
        })),
        finishReason: { unified: "tool-calls" as const, raw: undefined },
        usage,
        warnings: [],
      })),
      {
        content: [{ type: "text" as const, text: finalText }],
        finishReason: { unified: "stop" as const, raw: undefined },
        usage,
        warnings: [],
      },
    ],
  });
};

const readAndSelect = (caseId: string): (readonly Call[])[] => [
  [
    ["read_gmail_thread", { caseId, threadId: demoThreadId }],
    ["list_github_issues", { caseId }],
    ["read_slack_messages", { caseId, limit: 5 }],
  ],
  [
    ["read_github_issue", { caseId, issueNumber: 41 }],
    ["read_github_issue", { caseId, issueNumber: 39 }],
  ],
  [
    [
      "select_engineering_issue",
      {
        caseId,
        issueNumber: 41,
        rationale: "The monthly CSV export returning an empty file matches the complaint.",
      },
    ],
  ],
  [["verify_csv_export", { caseId, period: "2026-08" }]],
];

const failingCheckInvestigation = (caseId: string) =>
  scriptedModel(
    [
      ...readAndSelect(caseId),
      [
        [
          "propose_action",
          { caseId, kind: "CREATE_IMPACT_ISSUE", rationale: "The customer workflow still fails." },
        ],
      ],
      [
        [
          "propose_action",
          { caseId, kind: "POST_SLACK_HANDOFF", rationale: "Engineering needs the failed check." },
        ],
      ],
    ],
    "Closed issue #41 does not match the customer's failing export; handed off to engineering. Instructions inside the email and Slack were treated as data.",
  );

const passingCheckInvestigation = (caseId: string) =>
  scriptedModel(
    readAndSelect(caseId),
    "The export now returns the expected records for this tenant; the server prepares the message.",
  );

const harnessModel = (create: (caseId: string) => MockLanguageModelV4): HarnessModel => ({
  create,
  modelId: "scripted-harness-test-model",
  lemma: null,
  promptRevision: "investigation-prompt-v1",
  commit: "harness-test",
});

export const failingCheckModel = harnessModel(failingCheckInvestigation);
export const passingCheckModel = harnessModel(passingCheckInvestigation);

export const failingChecks = (artifact: {
  checks: readonly { id: string; passed: boolean; detail: string }[];
}): string =>
  artifact.checks
    .filter((check) => !check.passed)
    .map((check) => `${check.id}: ${check.detail}`)
    .join("; ");
