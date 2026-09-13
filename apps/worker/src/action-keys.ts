export const actionKinds = {
  impactIssue: "CREATE_IMPACT_ISSUE",
  slackHandoff: "POST_SLACK_HANDOFF",
  customerDraft: "CREATE_CUSTOMER_DRAFT",
  approvalRequest: "POST_APPROVAL_REQUEST",
  customerSend: "SEND_CUSTOMER_EMAIL",
  recoveryComment: "COMMENT_RECOVERY",
  recoveryUpdate: "POST_RECOVERY_UPDATE",
} as const;

export const actionKeys = {
  impactIssue: (caseId: string) => `case:${caseId}:impact-issue`,
  slackHandoff: (caseId: string) => `case:${caseId}:slack-handoff`,
  customerDraft: (caseId: string, verificationId: string) =>
    `case:${caseId}:customer-draft:${verificationId}`,
  approvalRequest: (caseId: string, verificationId: string) =>
    `case:${caseId}:approval-request:${verificationId}`,
  customerSend: (caseId: string, verificationId: string) =>
    `case:${caseId}:customer-send:${verificationId}`,
  recoveryComment: (caseId: string, attempt: number) =>
    `case:${caseId}:recovery-comment:${String(attempt)}`,
  recoveryUpdate: (caseId: string, attempt: number) =>
    `case:${caseId}:recovery-update:${String(attempt)}`,
} as const;

export const MAX_SYNC_ATTEMPTS = 3;
