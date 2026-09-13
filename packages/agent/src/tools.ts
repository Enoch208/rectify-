import {
  actionRecordSchema,
  caseRecordSchema,
  evidenceRecordSchema,
  verificationRecordSchema,
} from "@rectify/core";
import { tool } from "ai";
import { z } from "zod";
import type { ToolBudget } from "./tool-budget.ts";
import {
  gitHubIssueSummarySchema,
  toolInputSchemas,
  type AgentToolHandlers,
} from "./tool-contracts.ts";

export * from "./tool-contracts.ts";

const budgeted =
  <Input, Output>(
    budget: ToolBudget,
    schema: z.ZodType<Output>,
    handler: (input: Input) => Promise<unknown>,
  ) =>
  async (input: Input): Promise<Output> => {
    budget.consume();
    return schema.parse(await handler(input));
  };

const evidenceListSchema = z.array(evidenceRecordSchema);
const issueListSchema = z.array(gitHubIssueSummarySchema);

export const createAgentTools = (handlers: AgentToolHandlers, budget: ToolBudget) => ({
  get_case: tool({
    description: "Read the current persisted case state for the active case.",
    inputSchema: toolInputSchemas.caseInput,
    outputSchema: caseRecordSchema,
    strict: true,
    execute: budgeted(budget, caseRecordSchema, handlers.getCase),
  }),
  read_gmail_thread: tool({
    description: "Read the customer's source Gmail thread for the active case as evidence.",
    inputSchema: toolInputSchemas.gmailInput,
    outputSchema: evidenceListSchema,
    strict: true,
    execute: budgeted(budget, evidenceListSchema, handlers.readGmailThread),
  }),
  list_github_issues: tool({
    description:
      "List recent issues in the allowlisted engineering repository (number, title, state, labels) to find candidates.",
    inputSchema: toolInputSchemas.caseInput,
    outputSchema: issueListSchema,
    strict: true,
    execute: budgeted(budget, issueListSchema, handlers.listGitHubIssues),
  }),
  read_github_issue: tool({
    description: "Read one issue in the allowlisted repository and record it as evidence.",
    inputSchema: toolInputSchemas.githubInput,
    outputSchema: evidenceListSchema,
    strict: true,
    execute: budgeted(budget, evidenceListSchema, handlers.readGitHubIssue),
  }),
  select_engineering_issue: tool({
    description:
      "Record which engineering issue the complaint matches, with a rationale grounded in evidence already read. The server reads the issue state itself.",
    inputSchema: toolInputSchemas.selectionInput,
    outputSchema: caseRecordSchema,
    strict: true,
    execute: budgeted(budget, caseRecordSchema, handlers.selectEngineeringIssue),
  }),
  read_slack_messages: tool({
    description: "Read recent messages from the allowlisted engineering Slack channel as evidence.",
    inputSchema: toolInputSchemas.slackInput,
    outputSchema: evidenceListSchema,
    strict: true,
    execute: budgeted(budget, evidenceListSchema, handlers.readSlackMessages),
  }),
  verify_csv_export: tool({
    description:
      "Run the fixed csv-export-v1 check against the product for the case's authorized tenant and a reporting period.",
    inputSchema: toolInputSchemas.verificationInput,
    outputSchema: verificationRecordSchema,
    strict: true,
    execute: budgeted(budget, verificationRecordSchema, handlers.verifyCsvExport),
  }),
  propose_action: tool({
    description:
      "Propose a scoped internal action. The server builds the content, checks policy and executes it; you never write provider content.",
    inputSchema: toolInputSchemas.proposalInput,
    outputSchema: actionRecordSchema,
    strict: true,
    execute: budgeted(budget, actionRecordSchema, handlers.proposeAction),
  }),
  request_human: tool({
    description: "Place the active case into human review with a specific reason and resume point.",
    inputSchema: toolInputSchemas.humanInput,
    outputSchema: caseRecordSchema,
    strict: true,
    execute: budgeted(budget, caseRecordSchema, handlers.requestHuman),
  }),
});

export type AgentTools = ReturnType<typeof createAgentTools>;
