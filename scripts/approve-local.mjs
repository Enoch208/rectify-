import { createHmac } from "node:crypto";

const required = (name) => {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const [caseId, decision = "APPROVED", approverId = required("SLACK_APPROVER_IDS").split(",")[0]] =
  process.argv.slice(2);
if (caseId === undefined || !["APPROVED", "REJECTED"].includes(decision)) {
  process.stderr.write("Usage: pnpm approve:local <caseId> [APPROVED|REJECTED] [slackUserId]\n");
  process.exit(2);
}

const baseUrl = process.env.RECTIFY_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
const operator = { authorization: `Bearer ${required("RECTIFY_OPERATOR_TOKEN")}` };
const caseResponse = await fetch(new URL(`/api/cases/${encodeURIComponent(caseId)}`, baseUrl), {
  headers: operator,
});
if (!caseResponse.ok) {
  throw new Error(`Case read failed with HTTP ${String(caseResponse.status)}`);
}
const { approvals } = await caseResponse.json();
const pending = approvals.filter((approval) => approval.decision === "PENDING").at(-1);
if (pending === undefined) {
  throw new Error("This case has no pending approval request");
}

const payload = {
  type: "block_actions",
  team: { id: pending.slackWorkspaceId },
  user: { id: approverId },
  channel: { id: pending.slackChannelId },
  message: { ts: pending.slackMessageId },
  actions: [
    {
      action_id: "rectify_approval",
      value: JSON.stringify({ approvalId: pending.id, nonce: pending.nonce, decision }),
    },
  ],
};
const rawBody = new URLSearchParams({ payload: JSON.stringify(payload) }).toString();
const timestamp = String(Math.floor(Date.now() / 1_000));
const signature = `v0=${createHmac("sha256", required("SLACK_SIGNING_SECRET")).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`;
const response = await fetch(new URL("/api/slack/interactions", baseUrl), {
  method: "POST",
  headers: {
    "content-type": "application/x-www-form-urlencoded",
    "x-slack-request-timestamp": timestamp,
    "x-slack-signature": signature,
  },
  body: rawBody,
});
process.stdout.write(
  `Slack-signed ${decision} for approval ${pending.id}: HTTP ${String(response.status)} ${await response.text()}\n`,
);
process.exitCode = response.ok ? 0 : 1;
