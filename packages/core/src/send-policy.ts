import type { ActionRecord } from "./action.ts";
import type { ApprovalRecord } from "./approval.ts";
import type { CaseRecord } from "./case.ts";
import type { VerificationRecord } from "./verification.ts";

export interface CurrentDraft {
  providerAccountId: string;
  draftId: string;
  threadId: string;
  sender: string;
  recipients: readonly string[];
  subject: string;
  body: string;
  approvedMime: string;
  businessFieldsHash: string;
}

export interface SendPolicyInput {
  caseRecord: CaseRecord;
  action: ActionRecord;
  approval: ApprovalRecord;
  verification: VerificationRecord;
  currentDraft: CurrentDraft;
  currentAppRevision: number;
  currentConfigRevision: number;
  allowedRecipients: ReadonlySet<string>;
  contradictoryEvidence: boolean;
  now: Date;
}

export type SendPolicyDecision = { authorized: true } | { authorized: false; reason: string };

const rejected = (reason: string): SendPolicyDecision => ({ authorized: false, reason });

export const authorizeCustomerSend = (input: SendPolicyInput): SendPolicyDecision => {
  const { approval, caseRecord, action, verification, currentDraft } = input;
  if (caseRecord.state !== "READY_FOR_APPROVAL") return rejected("Case is not ready for approval");
  if (approval.decision !== "APPROVED") return rejected("Approval is not approved");
  if (approval.consumedAt !== null || approval.revokedAt !== null)
    return rejected("Approval is not usable");
  if (new Date(approval.expiresAt).getTime() <= input.now.getTime())
    return rejected("Approval has expired");
  if (approval.caseId !== caseRecord.id || approval.caseVersion !== caseRecord.version)
    return rejected("Case version changed");
  if (
    approval.organizationId !== caseRecord.organizationId ||
    approval.tenantId !== caseRecord.tenantId
  )
    return rejected("Approval identity changed");
  if (action.provider !== "gmail" || approval.actionId !== action.id)
    return rejected("Approval action does not match");
  if (action.status !== "PLANNED") return rejected("Customer send action is not dispatchable");
  if (approval.actionVersion !== action.version || approval.actionHash !== action.payloadHash)
    return rejected("Approved action version changed");
  if (verification.id !== approval.verificationId || verification.result !== "PASS")
    return rejected("A matching passing verification is required");
  if (verification.caseId !== caseRecord.id || verification.input.tenantId !== caseRecord.tenantId)
    return rejected("Verification identity changed");
  const verificationAge = input.now.getTime() - new Date(verification.verifiedAt).getTime();
  if (verificationAge < 0 || verificationAge >= 300_000)
    return rejected("Verification has expired");
  if (
    approval.appRevision !== input.currentAppRevision ||
    approval.configRevision !== input.currentConfigRevision
  )
    return rejected("Application configuration changed");
  if (
    verification.input.appRevision !== input.currentAppRevision ||
    verification.input.configRevision !== input.currentConfigRevision
  )
    return rejected("Verification revisions are stale");
  if (
    approval.providerAccountId !== currentDraft.providerAccountId ||
    approval.draftId !== currentDraft.draftId ||
    approval.threadId !== currentDraft.threadId
  )
    return rejected("Provider draft identity changed");
  if (
    approval.sender !== currentDraft.sender ||
    approval.subject !== currentDraft.subject ||
    approval.body !== currentDraft.body
  )
    return rejected("Draft content changed");
  if (
    approval.recipients.length !== 1 ||
    currentDraft.recipients.length !== 1 ||
    approval.recipients[0] !== currentDraft.recipients[0]
  )
    return rejected("Draft recipients changed");
  const recipient = approval.recipients[0];
  if (recipient === undefined || !input.allowedRecipients.has(recipient))
    return rejected("Recipient is not allowed");
  if (recipient !== caseRecord.contactEmail || approval.threadId !== caseRecord.sourceThreadId)
    return rejected("Customer identity changed");
  if (
    approval.businessFieldsHash !== currentDraft.businessFieldsHash ||
    approval.approvedMime !== currentDraft.approvedMime
  )
    return rejected("Approved payload changed");
  if (input.contradictoryEvidence) return rejected("Contradictory evidence requires human review");
  return { authorized: true };
};
