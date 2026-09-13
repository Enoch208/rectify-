import type { CaseRecord, VerificationRecord } from "@rectify/core";
import { rectifyMarker } from "@rectify/providers";

const verificationSummary = (verification: VerificationRecord): string => {
  const http =
    verification.observed.httpStatus === null
      ? "no response"
      : `HTTP ${String(verification.observed.httpStatus)}`;
  return `${http}; ${String(verification.observed.rows.length)} of ${String(verification.expected.rows.length)} expected records; result ${verification.result}${verification.observed.failureReason === null ? "" : ` (${verification.observed.failureReason})`}`;
};

export const impactIssueContent = (
  record: CaseRecord,
  verification: VerificationRecord,
  logicalKey: string,
) => ({
  title: `Customer impact: CSV export still failing for tenant ${record.tenantId}`,
  body: [
    "## Customer impact",
    `A customer on tenant \`${record.tenantId}\` reports the ${record.workflow} workflow still fails.`,
    record.matchedEngineeringIssueId === null
      ? "No engineering issue has been matched yet."
      : `Related engineering issue: #${record.matchedEngineeringIssueId}. This issue is not being reopened; the fix may not have reached this tenant.`,
    "",
    "## Reproduction (redacted)",
    `Contract \`${verification.contractVersion}\`, reporting period \`${verification.input.period}\`, manifest revision ${String(verification.input.manifestRevision)}, app revision ${String(verification.input.appRevision)}, config revision ${String(verification.input.configRevision)}.`,
    "",
    "## Expected vs observed",
    `Expected ${String(verification.expected.rows.length)} records. Observed: ${verificationSummary(verification)}.`,
    `Request ID \`${verification.requestId}\`, checked at ${verification.verifiedAt}.`,
    "",
    "## Next engineering question",
    "Is the corrected export path enabled for this tenant's configuration?",
    "",
    `_${rectifyMarker(logicalKey)}_`,
  ].join("\n"),
});

export const slackHandoffText = (
  record: CaseRecord,
  verification: VerificationRecord,
  issueUrl: string,
  logicalKey: string,
): string =>
  [
    `Customer workflow still failing for tenant ${record.tenantId} (${record.workflow}).`,
    `Check: ${verificationSummary(verification)}.`,
    `Impact issue: ${issueUrl}`,
    "Question: is the corrected export path enabled for this tenant's configuration?",
    `(${rectifyMarker(logicalKey)})`,
  ].join("\n");

export const customerEmailContent = (
  record: CaseRecord,
  verification: VerificationRecord,
  portalUrl: string,
  subject: string | null,
) => {
  const link = new URL("/customer", portalUrl);
  link.searchParams.set("case", record.id);
  return {
    subject:
      subject === null
        ? "Your ReportDesk CSV export"
        : subject.startsWith("Re:")
          ? subject
          : `Re: ${subject}`,
    body: [
      "Hello,",
      "",
      `We re-ran the monthly CSV export for your workspace for the ${verification.input.period} reporting period, and it now returns the records we expect.`,
      "",
      `Please try the export again here: ${link.toString()}`,
      "",
      "If it still does not work for you, reply to this email and we will look into it straight away.",
      "",
      "ReportDesk Support",
    ].join("\n"),
  };
};

export const approvalRequestText = (
  recipient: string,
  subject: string,
  body: string,
  verification: VerificationRecord,
  logicalKey: string,
): string =>
  [
    "Approval needed: exact customer message",
    `To: ${recipient}`,
    `Subject: ${subject}`,
    "",
    body,
    "",
    `Check: ${verificationSummary(verification)} at ${verification.verifiedAt}. Approval expires in 5 minutes.`,
    `(${rectifyMarker(logicalKey)})`,
  ].join("\n");

export const approvalBlocks = (
  text: string,
  approvalId: string,
  nonce: string,
): Record<string, unknown>[] => [
  { type: "section", text: { type: "mrkdwn", text: text.slice(0, 2900) } },
  {
    type: "actions",
    elements: (["APPROVED", "REJECTED"] as const).map((decision) => ({
      type: "button",
      action_id: "rectify_approval",
      text: { type: "plain_text", text: decision === "APPROVED" ? "Approve and send" : "Reject" },
      style: decision === "APPROVED" ? "primary" : "danger",
      value: JSON.stringify({ approvalId, nonce, decision }),
    })),
  },
];

export const recoveryText = (
  record: CaseRecord,
  eventRequestId: string,
  logicalKey: string,
): string =>
  [
    `Customer recovery observed for tenant ${record.tenantId}: the customer's own ${record.workflow} export succeeded (product request ${eventRequestId}).`,
    "The original engineering issue status was not changed by Rectify.",
    `(${rectifyMarker(logicalKey)})`,
  ].join("\n");
