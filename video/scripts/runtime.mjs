import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const supplied = parseEnv(readFileSync(resolve(root, ".env"), "utf8"));
const directory = resolve(root, ".data", `video-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const token = () => randomBytes(24).toString("hex");
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  NODE_ENV: "production",
  PORT: "3400",
  RECTIFY_DB_PATH: resolve(directory, "rectify.sqlite"),
  RECTIFY_OPERATOR_TOKEN: token(),
  RECTIFY_INTAKE_DIRECTORY_JSON: JSON.stringify([
    {
      gmailThreadId: "thread-northstar-export",
      organizationId: "reportdesk",
      tenantId: "northstar",
      contactId: "contact-maya",
      contactEmail: "maya@northstar.example",
    },
  ]),
  RECTIFY_PRODUCT_EVENTS_URL: "http://127.0.0.1:3400/api/product-events",
  RECTIFY_RELEASE_ID: "submission-demo",
  RECTIFY_COMMIT: "1fab5d8",
  RECTIFY_WORKER_POLL_MS: "250",
  GMAIL_MODE: "local_fixture",
  GMAIL_SENDER_ADDRESS: "support@reportdesk.example",
  GITHUB_MODE: "local_fixture",
  GITHUB_OWNER: "reportdesk",
  GITHUB_REPO: "app",
  SLACK_MODE: "local_fixture",
  SLACK_CHANNEL_ID: "channel-demo",
  SLACK_WORKSPACE_ID: "workspace-demo",
  SLACK_SIGNING_SECRET: token(),
  SLACK_APPROVER_IDS: "approver-demo",
  REPORTDESK_PORT: "3410",
  REPORTDESK_BASE_URL: "http://127.0.0.1:3410",
  REPORTDESK_PUBLIC_URL: "http://127.0.0.1:3410",
  REPORTDESK_ENVIRONMENT: "LOCAL FIXTURE",
  REPORTDESK_PROBE_TOKEN: token(),
  REPORTDESK_OPERATOR_TOKEN: token(),
  REPORTDESK_OPERATOR_ID: "demo-operator",
  REPORTDESK_CUSTOMER_TOKEN: token(),
  REPORTDESK_OUTCOME_SECRET: token(),
};
for (const key of [
  "OPENAI_API_KEY",
  "RECTIFY_MODEL_ID",
  "LEMMA_API_KEY",
  "LEMMA_PROJECT_ID",
  "LEMMA_RELEASE",
]) {
  if (supplied[key]) env[key] = supplied[key];
}
writeFileSync(resolve(root, ".data/video-runtime.json"), JSON.stringify(env), { mode: 0o600 });
const commands = [
  ["node", ["apps/web/node_modules/next/dist/bin/next", "start", "apps/web", "-p", "3400"]],
  ["node", ["apps/reportdesk/src/start.ts"]],
  ["node", ["apps/worker/src/main.ts"]],
];
const children = commands.map(([command, args]) =>
  spawn(command, args, { cwd: root, env, stdio: "inherit" }),
);
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill("SIGTERM"));
}
children.forEach((child) => child.on("exit", stop));
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
process.stdout.write(
  "Isolated recording runtime: Rectify :3400, ReportDesk :3410; providers LOCAL FIXTURE\n",
);
