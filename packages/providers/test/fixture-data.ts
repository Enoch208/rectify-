import {
  buildCustomerMime,
  type CustomerMessage,
  type GitHubIssue,
  type GmailMessage,
} from "../src/index.ts";

export const fixtureMessage = (id: string, threadId: string): GmailMessage => ({
  id,
  threadId,
  from: "maya@northstar.example",
  to: "support@reportdesk.example",
  subject: "Empty CSV export",
  date: "Mon, 7 Sep 2026 09:00:00 +0000",
  bodyText: "The monthly export is empty.",
});

export const fixtureIssue = (
  number: number,
  state: "open" | "closed",
  body: string | null,
): GitHubIssue => ({
  id: number,
  number,
  title: `Fixture issue ${String(number)}`,
  body,
  state,
  html_url: `https://github.local/rectify/provider-tests/issues/${String(number)}`,
  labels: [],
  updated_at: "2026-09-01T00:00:00.000Z",
});

export const customerMessage = (overrides: Partial<CustomerMessage> = {}): CustomerMessage => ({
  from: "support@reportdesk.example",
  to: "maya@northstar.example",
  subject: "Re: Empty CSV export",
  body: "Your export works again.\r\nThanks for your patience.",
  threadId: "thread-1",
  inReplyTo: "<original@northstar.example>",
  logicalKey: "case-1:send-customer-reply:v1",
  rfc822MessageId: "case-1.v1@rectify.test",
  ...overrides,
});

export const customerMime = (overrides: Partial<CustomerMessage> = {}): string =>
  buildCustomerMime(customerMessage(overrides));
