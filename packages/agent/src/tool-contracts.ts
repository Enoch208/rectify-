import type { ActionRecord, CaseRecord, EvidenceRecord, VerificationRecord } from "@rectify/core";
import { z } from "zod";

const caseInput = z.object({ caseId: z.string().min(1) });

export const toolInputSchemas = {
  caseInput,
  gmailInput: caseInput.extend({ threadId: z.string().min(1) }),
  githubInput: caseInput.extend({ issueNumber: z.number().int().positive() }),
  selectionInput: caseInput.extend({
    issueNumber: z.number().int().positive(),
    rationale: z.string().min(1).max(2_000),
  }),
  slackInput: caseInput.extend({ limit: z.number().int().min(1).max(20) }),
  verificationInput: caseInput.extend({ period: z.string().min(1) }),
  proposalInput: caseInput.extend({
    kind: z.enum(["CREATE_IMPACT_ISSUE", "POST_SLACK_HANDOFF"]),
    rationale: z.string().min(1).max(2_000),
  }),
  humanInput: caseInput.extend({
    reason: z.string().min(1).max(2_000),
    resumeState: z.enum([
      "NEW",
      "INVESTIGATING",
      "WAITING_ENGINEERING",
      "READY_FOR_APPROVAL",
      "WAITING_CUSTOMER",
    ]),
  }),
} as const;

export const gitHubIssueSummarySchema = z.object({
  number: z.number().int().positive(),
  title: z.string().min(1),
  state: z.enum(["open", "closed"]),
  labels: z.array(z.string()),
});

export type GitHubIssueSummary = z.infer<typeof gitHubIssueSummarySchema>;

type Input<Name extends keyof typeof toolInputSchemas> = z.infer<(typeof toolInputSchemas)[Name]>;

export interface AgentToolHandlers {
  readonly getCase: (input: Input<"caseInput">) => Promise<CaseRecord>;
  readonly readGmailThread: (input: Input<"gmailInput">) => Promise<EvidenceRecord[]>;
  readonly listGitHubIssues: (input: Input<"caseInput">) => Promise<GitHubIssueSummary[]>;
  readonly readGitHubIssue: (input: Input<"githubInput">) => Promise<EvidenceRecord[]>;
  readonly selectEngineeringIssue: (input: Input<"selectionInput">) => Promise<CaseRecord>;
  readonly readSlackMessages: (input: Input<"slackInput">) => Promise<EvidenceRecord[]>;
  readonly verifyCsvExport: (input: Input<"verificationInput">) => Promise<VerificationRecord>;
  readonly proposeAction: (input: Input<"proposalInput">) => Promise<ActionRecord>;
  readonly requestHuman: (input: Input<"humanInput">) => Promise<CaseRecord>;
}
