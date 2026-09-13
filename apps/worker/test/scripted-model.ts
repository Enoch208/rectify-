import { MockLanguageModelV4 } from "ai/test";

const usage = {
  inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

type Call = readonly [toolName: string, input: Record<string, unknown>];

export const scriptedModel = (steps: readonly (readonly Call[])[], finalText: string) => {
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

export const northstarInvestigation = (caseId: string) =>
  scriptedModel(
    [
      [
        ["read_gmail_thread", { caseId, threadId: "thread-northstar-export" }],
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
            rationale: "Monthly CSV export returning an empty file matches the complaint.",
          },
        ],
      ],
      [["verify_csv_export", { caseId, period: "2026-08" }]],
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
    "Closed issue #41 does not match the customer's failing export; handed off to engineering.",
  );
