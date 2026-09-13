# Rectify

**Closed isn't fixed.** Rectify carries a customer complaint from Gmail through GitHub and Slack and back to the customer. It runs the customer's own workflow to check whether it actually works, hands failures to engineering, sends only a human-approved message, and marks a case recovered only when the product observes the customer succeeding.

The demo product is ReportDesk. A customer at Northstar Research reports an empty monthly CSV export. The engineering issue is closed and Slack says the rollout is complete, but the export still returns HTTP 200 with no records for Northstar. Rectify catches that, opens a customer-impact issue, posts a Slack handoff, waits for a human-applied configuration fix, rechecks, requests approval for the exact email, sends it, and observes the customer's own successful export.

**[Watch the two-minute narrated demo](https://enoch208.github.io/rectify-/demo/)** · [Download MP4](https://enoch208.github.io/rectify-/demo/rectify-demo.mp4) · [Editable recording source](video/README.md)

The demo uses the actual application with a real investigation model and explicitly labelled local fixtures for Gmail, GitHub and Slack. It includes English captions and a transcript; no login is required.

## Status

| Area | State |
|---|---|
| Case store, action ledger, job queue, approvals, clarifications | Implemented, locally tested |
| Worker: investigation and recheck jobs, engineering handoff, draft and Slack approval request, policy-checked send, recovery sync | Implemented, locally tested end to end with fixture providers and a scripted model |
| Provider reconciliation for Gmail, GitHub and Slack writes | Implemented, locally tested |
| Operator workspace, sign-in, case and run views | Implemented, locally tested in a browser |
| ReportDesk demo product with customer and operator pages | Implemented, locally tested |
| E01–E06 scenario runner and independent checker | Implemented; each scenario passes the checker in tests with scripted models (not a benchmark result) |
| Live Gmail, GitHub and Slack | Not exercised in the recorded walkthrough; providers are explicitly `LOCAL FIXTURE` |
| Real model investigation turn | Recorded successfully with `gpt-5.4-mini-2026-03-17`: 10 tool calls, 21.691 seconds; complete fixture-backed recovery flow |
| Openable Lemma trace | Not verified; the recorded run's trace ID was null |
| Final 18-trial evaluation with a real model | `NOT RUN` |
| Arga twins | `NOT RUN` |
| Docker deployment | Built and runtime-smoked locally with all three processes and persistent SQLite restart state |

Fixture-backed results are labelled `LOCAL FIXTURE` everywhere they appear and are never presented as live provider results.

External apps: Gmail supplies the support thread and approved customer email; GitHub supplies engineering issues and customer-impact follow-through; Slack supplies rollout claims, engineering handoff and human approval. OpenAI provides the bounded investigation model, and Lemma instrumentation is present for tracing. ReportDesk is the included demo product, not an external service. [Recording source and reproduction notes](video/README.md) distinguish the recorded fixture workflow from live integrations and benchmark results.

## How it works

```
Operator (web) ──► case API ──► SQLite case store ◄── worker loop
                                     ▲                  │
ReportDesk customer export ──signed outcome──┘          ├─ bounded agent turn (AI SDK, Lemma)
                                                        ├─ csv-export-v1 verifier ─► ReportDesk probe
                                                        ├─ action ledger ─► Gmail / GitHub / Slack
                                                        └─ reconcilers on restart and every 30 s
Slack approver ──signed interaction──► approval binding
```

- The model proposes. It reads the case's own Gmail thread, lists and reads GitHub issues, reads Slack, selects the matching engineering issue and runs the export check. It never writes provider content.
- Server policy decides. Every external write is recorded before dispatch with a unique logical key. The customer send re-reads the Gmail draft, the product configuration revision and the trusted recipient directory, checks a fresh passing verification and an unused approval, then sends the stored approved content.
- Observed evidence moves the case. A closed issue, a rollout message, a passing probe or a sent email never marks recovery. Only a signed customer outcome from ReportDesk does, and the case is complete only after GitHub and Slack updates are confirmed.

| Package | Role |
|---|---|
| `packages/core` | Shared records, API contracts, action ledger, send policy, outcome signing |
| `packages/store` | Case, evidence, verification, approval, run, job and clarification persistence; trusted intake; Slack approval binding |
| `packages/providers` | Gmail, GitHub and Slack adapters (`live`, `arga`, `local_fixture`), MIME helpers, reconcilers |
| `packages/agent` | Bounded tool-using turn (20 tool calls, 90 s) with Lemma tracing |
| `packages/verifier` | `csv-export-v1` exact manifest check |
| `apps/worker` | Long-running job and follow-through loop |
| `apps/web` | Landing page, operator workspace and API |
| `apps/reportdesk` | Demo product, customer export page, operator fix page |
| `evals` | E01–E06 scenario runner and independent checker |

## Requirements

- Node 24 or newer, pnpm 10.33.0
- A persistent filesystem for SQLite shared by the web app and the worker

```sh
pnpm install --frozen-lockfile
```

## Configuration

Copy `.env.example` to `.env` and fill it in. Every provider mode must be set explicitly to `live`, `arga` or `local_fixture`; missing credentials fail loudly and never fall back to fixtures.

| Group | Variables |
|---|---|
| Rectify | `RECTIFY_DB_PATH`, `RECTIFY_OPERATOR_TOKEN`, `RECTIFY_INTAKE_DIRECTORY_JSON`, `RECTIFY_PRODUCT_EVENTS_URL`, `RECTIFY_RELEASE_ID`, `RECTIFY_COMMIT` |
| Model and tracing | `OPENAI_API_KEY`, `RECTIFY_MODEL_ID`, `LEMMA_API_KEY`, `LEMMA_PROJECT_ID`, `LEMMA_RELEASE` |
| Gmail | `GMAIL_MODE`, `GMAIL_SENDER_ADDRESS`, `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`, `GMAIL_OAUTH_REFRESH_TOKEN` (or `GMAIL_ACCESS_TOKEN`), `GMAIL_PROVIDER_ACCOUNT_ID` |
| GitHub | `GITHUB_MODE`, `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` |
| Slack | `SLACK_MODE`, `SLACK_TOKEN`, `SLACK_CHANNEL_ID`, `SLACK_WORKSPACE_ID`, `SLACK_SIGNING_SECRET`, `SLACK_APPROVER_IDS` |
| ReportDesk | `REPORTDESK_PORT`, `REPORTDESK_BASE_URL`, `REPORTDESK_PUBLIC_URL`, `REPORTDESK_ENVIRONMENT`, `REPORTDESK_PROBE_TOKEN`, `REPORTDESK_OPERATOR_TOKEN`, `REPORTDESK_OPERATOR_ID`, `REPORTDESK_CUSTOMER_TOKEN`, `REPORTDESK_OUTCOME_SECRET` |
| Arga | `GMAIL_ARGA_*`, `GITHUB_ARGA_*`, `SLACK_ARGA_*` |

`RECTIFY_INTAKE_DIRECTORY_JSON` is the trusted directory. Email content can never add a tenant or recipient:

```json
[{ "gmailThreadId": "thread-id", "organizationId": "org", "tenantId": "northstar", "contactId": "contact-maya", "contactEmail": "maya@northstar.example" }]
```

Provider permissions: Gmail OAuth with the `gmail.modify` scope on the support mailbox; a fine-grained GitHub token limited to one repository with Issues read and write; a Slack bot token with `chat:write` and `channels:history`, with Interactivity pointing at `https://<rectify-host>/api/slack/interactions`.

## Run locally

```sh
pnpm dev:local
```

This starts the web app (`:3000`), ReportDesk (`REPORTDESK_PORT`) and the worker with the variables from `.env`. With every provider mode set to `local_fixture`, the Northstar thread `thread-northstar-export`, its distractor issues and the rollout message are available as labelled fixtures.

Rehearsal:

1. Open `/sign-in`, enter `RECTIFY_OPERATOR_TOKEN`, then open the case from `thread-northstar-export` and press **Investigate**. Without a model key the case stops for a human and says why.
2. Open ReportDesk `/operator` and enable the corrected export path, then press **Recheck workflow**.
3. Approve the exact message. In live Slack the approver clicks **Approve and send**. With fixture Slack, `pnpm approve:local <caseId>` sends the same Slack-signed interaction to the app.
4. Open the link in the sent email (ReportDesk `/customer?case=<caseId>`), enter the customer token and export. Rectify records recovery and finishes the GitHub and Slack updates.

## Verification

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

Provider smoke, one real read and one real write per provider:

```sh
pnpm smoke:providers
```

## Evaluation

The scenario runner drives E01–E06 through the real store, worker, ReportDesk and approval binding with fixture providers, captures each trial's actual state, and refuses to run without a real model:

```sh
RECTIFY_EVAL_ARTIFACT_DIR=./eval-artifacts RECTIFY_EVAL_OUTCOME_SECRET=<secret> pnpm eval:run
RECTIFY_EVAL_ARTIFACT_DIR=./eval-artifacts RECTIFY_EVAL_RESULTS_DIR=./eval-results RECTIFY_EVAL_OUTCOME_SECRET=<secret> pnpm eval
```

The checker ignores agent-written claims and grades provider effects, tenant scope, approvals, signed outcomes, deduplication and scenario-specific safety outcomes.

## Deploy

One host with a persistent volume runs all three processes:

```sh
docker build -t rectify .
docker run -p 3000:3000 -p 3100:3100 -v rectify-data:/data --env-file .env rectify
```

Set `RECTIFY_DB_PATH=/data/rectify.sqlite`, `RECTIFY_PRODUCT_EVENTS_URL=http://127.0.0.1:3000/api/product-events`, `REPORTDESK_BASE_URL=http://127.0.0.1:3100`, and `REPORTDESK_PUBLIC_URL` to the public ReportDesk address used in the customer email link. `pnpm start:all` runs the same supervisor without Docker after `pnpm --filter @rectify/web build`.

## Known limitations

- One workflow (`csv-export-v1`), one organization, one mailbox, one repository, one Slack channel.
- ReportDesk keeps tenant configuration in memory; restarting it resets the demo fix.
- Verification and approval expire after five minutes by design; a slow approver must recheck.
- Reconciliation searches the most recent 50 issues, 100 comments and 100 Slack messages; anything older stays `OUTCOME_UNKNOWN` and is held for a human.
- The scenario runner supports fixture providers only; it does not reset live or Arga provider state.
- No claim of exactly-once delivery across SQLite and external providers, arbitrary-product verification, or universal prompt-injection resistance.
