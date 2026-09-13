import {
  actionRecordSchema,
  caseRecordSchema,
  evidenceRecordSchema,
  verificationRecordSchema,
  type ActionRecord,
  type CaseRecord,
  type EvidenceRecord,
  type VerificationRecord,
} from "@rectify/core";
import { tool } from "ai";
import { z } from "zod";
import type { ToolBudget } from "./tool-budget.ts";

const caseInputSchema = z.object({ caseId: z.string().min(1) });
const gmailInputSchema = caseInputSchema.extend({ threadId: z.string().min(1) });
const githubInputSchema = caseInputSchema.extend({ issueNumber: z.number().int().positive() });
const slackInputSchema = caseInputSchema.extend({ limit: z.number().int().min(1).max(20) });
const verificationInputSchema = caseInputSchema.extend({ period: z.string().min(1) });
const proposalInputSchema = caseInputSchema.extend({
  kind: z.enum(["CREATE_IMPACT_ISSUE", "POST_SLACK_HANDOFF", "CREATE_CUSTOMER_DRAFT"]),
  rationale: z.string().min(1).max(2_000),
});
const humanInputSchema = caseInputSchema.extend({
  reason: z.string().min(1).max(2_000),
  resumeState: z.enum([
    "NEW",
    "INVESTIGATING",
    "WAITING_ENGINEERING",
    "READY_FOR_APPROVAL",
    "WAITING_CUSTOMER",
  ]),
});

export interface AgentToolHandlers {
  getCase(input: z.infer<typeof caseInputSchema>): Promise<CaseRecord>;
  readGmailThread(input: z.infer<typeof gmailInputSchema>): Promise<EvidenceRecord[]>;
  readGitHubIssue(input: z.infer<typeof githubInputSchema>): Promise<EvidenceRecord[]>;
  readSlackMessages(input: z.infer<typeof slackInputSchema>): Promise<EvidenceRecord[]>;
  verifyCsvExport(input: z.infer<typeof verificationInputSchema>): Promise<VerificationRecord>;
  proposeAction(input: z.infer<typeof proposalInputSchema>): Promise<ActionRecord>;
  requestHuman(input: z.infer<typeof humanInputSchema>): Promise<CaseRecord>;
}

export const createAgentTools = (handlers: AgentToolHandlers, budget: ToolBudget) => ({
  get_case: tool({
    description: "Read the current persisted case state for the active case.",
    inputSchema: caseInputSchema,
    outputSchema: caseRecordSchema,
    strict: true,
    execute: async (input) => {
      budget.consume();
      return caseRecordSchema.parse(await handlers.getCase(input));
    },
  }),
  read_gmail_thread: tool({
    description: "Read evidence from one allowlisted Gmail thread for the active case.",
    inputSchema: gmailInputSchema,
    outputSchema: z.array(evidenceRecordSchema),
    strict: true,
    execute: async (input) => {
      budget.consume();
      return z.array(evidenceRecordSchema).parse(await handlers.readGmailThread(input));
    },
  }),
  read_github_issue: tool({
    description: "Read evidence from one issue in the allowlisted repository.",
    inputSchema: githubInputSchema,
    outputSchema: z.array(evidenceRecordSchema),
    strict: true,
    execute: async (input) => {
      budget.consume();
      return z.array(evidenceRecordSchema).parse(await handlers.readGitHubIssue(input));
    },
  }),
  read_slack_messages: tool({
    description: "Read evidence from the case's allowlisted Slack channel.",
    inputSchema: slackInputSchema,
    outputSchema: z.array(evidenceRecordSchema),
    strict: true,
    execute: async (input) => {
      budget.consume();
      return z.array(evidenceRecordSchema).parse(await handlers.readSlackMessages(input));
    },
  }),
  verify_csv_export: tool({
    description: "Run the fixed csv-export-v1 verifier for the active tenant and period.",
    inputSchema: verificationInputSchema,
    outputSchema: verificationRecordSchema,
    strict: true,
    execute: async (input) => {
      budget.consume();
      return verificationRecordSchema.parse(await handlers.verifyCsvExport(input));
    },
  }),
  propose_action: tool({
    description: "Persist a scoped action proposal for server-side policy authorization.",
    inputSchema: proposalInputSchema,
    outputSchema: actionRecordSchema,
    strict: true,
    execute: async (input) => {
      budget.consume();
      return actionRecordSchema.parse(await handlers.proposeAction(input));
    },
  }),
  request_human: tool({
    description: "Place the active case into a specific human-review state with a resume point.",
    inputSchema: humanInputSchema,
    outputSchema: caseRecordSchema,
    strict: true,
    execute: async (input) => {
      budget.consume();
      return caseRecordSchema.parse(await handlers.requestHuman(input));
    },
  }),
});

export type AgentTools = ReturnType<typeof createAgentTools>;
