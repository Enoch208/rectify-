import type { GitHubIssue, GmailThread, SlackMessage } from "@rectify/providers";
import type { IntakeEntry } from "@rectify/store";

export const demoThreadId = "thread-northstar-export";
export const demoSender = "support@reportdesk.example";

export const demoIntakeDirectory: readonly IntakeEntry[] = [
  {
    gmailThreadId: demoThreadId,
    organizationId: "reportdesk",
    tenantId: "northstar",
    contactId: "contact-maya",
    contactEmail: "maya@northstar.example",
  },
];

export const demoThreads: readonly GmailThread[] = [
  {
    id: demoThreadId,
    messages: [
      {
        id: "message-northstar-1",
        threadId: demoThreadId,
        from: "Maya Chen <maya@northstar.example>",
        to: demoSender,
        subject: "Monthly report export still empty",
        date: "Sun, 13 Sep 2026 09:12:00 -0700",
        bodyText:
          "Hi, our monthly report export is still empty. We need it for tomorrow's review. Can you check the August report?\n\nMaya\nOperations lead, Northstar Research",
      },
    ],
  },
];

const issue = (
  number: number,
  title: string,
  state: "open" | "closed",
  labels: string[],
  body: string,
): GitHubIssue => ({
  id: 9_000 + number,
  number,
  title,
  body,
  state,
  html_url: `https://github.local/reportdesk/app/issues/${String(number)}`,
  labels,
  updated_at: "2026-09-12T18:00:00Z",
});

export const demoIssues: readonly GitHubIssue[] = [
  issue(
    38,
    "PDF invoice totals round to the wrong cent",
    "open",
    ["billing"],
    "Invoice PDFs round totals incorrectly for some currencies.",
  ),
  issue(
    39,
    "Weekly CSV export is missing the header row",
    "closed",
    ["export"],
    "Weekly exports omitted the header. Fixed in #40.",
  ),
  issue(
    41,
    "Monthly CSV export returns an empty file",
    "closed",
    ["export", "bug"],
    "Monthly exports returned HTTP 200 with no records. Fixed by the corrected export path; merged and rolled out.",
  ),
  issue(
    44,
    "Dashboard chart tooltip overlaps the legend",
    "closed",
    ["ui"],
    "Tooltip positioning fix.",
  ),
];

export const demoSlackMessages: readonly SlackMessage[] = [
  {
    ts: "1757775600.000100",
    text: "Heads up: invoice PDF rounding (#38) is still being investigated.",
  },
  {
    ts: "1757779200.000200",
    text: "Rollout of the monthly CSV export fix (#41) is complete for all tenants.",
  },
];
