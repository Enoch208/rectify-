# System and reliability brief

## Workflow and responsibility

Rectify starts from an operator-selected Gmail thread in a trusted intake directory. It records a case, gathers scoped evidence, verifies the affected tenant's `csv-export-v1` workflow, persists provider-write intent, waits for human changes or approval where required, and accepts recovery only from a signed ReportDesk customer outcome.

The model may interpret untrusted content, select narrow read/check tools, and propose actions. Server policy owns tenant identity, recipient identity, state transitions, approval validity, write authorization, and recovery. Provider adapters execute typed reads and writes. The independent evaluator owns verdicts.

## Components

- `packages/core` contains browser-safe records and API schemas. Node-only SQLite, outcome signing, and send policy are explicit subpath exports.
- `apps/reportdesk` contains tenant configuration revisions, one customer/probe export implementation, the authenticated human fix, audit records, and customer outcome signing.
- `packages/verifier` executes the same export and compares exact manifest schema and values. Timeouts are inconclusive and a legitimate zero-row manifest passes.
- `packages/providers` contains explicit `live`, `arga`, and `local_fixture` Gmail, GitHub, and Slack adapters. There is no mode fallback.
- `apps/worker` persists action intent before writes, prevents duplicate logical effects, records ambiguous responses as `OUTCOME_UNKNOWN`, and reconciles after restart.
- `packages/agent` limits a turn to 20 tool calls and 90 seconds using the installed AI SDK. Lemma delivery failure is surfaced without rewriting business state.
- `apps/web/src/server` and `apps/web/src/app/api` contain SQLite case persistence, trusted intake, authenticated operator routes, state-guarded commands, Slack decisions, and signed product outcomes.
- `evals` contains frozen E01–E06 definitions, the captured-state schema, an independent checker, and an 18-trial verdict writer.

## State and evidence truth

Engineering state, workflow verification, notification state, customer recovery, and final synchronization remain separate fields. A closed issue, rollout claim, HTTP 200 response, passing probe, draft, send, email open, or link click cannot independently set recovery.

`GET /api/cases`, case detail, run list, and run detail return only the shared Zod contracts. Unknown resources and rejected commands return JSON `{ "error": "..." }`. Investigate is accepted only from `NEW`; recheck is accepted only from `WAITING_ENGINEERING` or `NEEDS_HUMAN`. The transition and queued job are written in one SQLite transaction.

## Identity and scope

Case creation accepts only a Gmail thread ID already present in `RECTIFY_INTAKE_DIRECTORY_JSON`. Email text, names, signatures, and retrieved instructions cannot create tenant or recipient mappings. The agent receives no arbitrary HTTP, shell, database, or deployment tool.

The operator session validates `RECTIFY_OPERATOR_TOKEN` in constant time and stores an HttpOnly, `SameSite=Strict` cookie. Bearer authentication is also accepted. Slack and ReportDesk callbacks use their own signed server boundaries rather than the operator cookie.

## Approval and customer send

Slack verification hashes `v0:{timestamp}:{rawBody}`, enforces a five-minute timestamp window, and compares signatures in constant time before parsing the form body. A decision is then bound to the stored workspace, channel, message, allowlisted approver, nonce, and expiry. Replayed or already decided approvals are rejected.

The server-only customer-send policy additionally checks case and action versions, organization and tenant, provider account, draft and thread identity, sender, single allowlisted recipient, subject, body, stored MIME, business-field hash, a fresh passing verification, unchanged app/config revisions, unconsumed approval, and contradictory evidence. Authorization is a pre-dispatch decision; it is not a provider success claim.

## Writes and uncertainty

The action ledger uses a unique logical key and immutable intent trigger. The worker writes `DISPATCHING` before calling a provider. A lost or ambiguous response becomes `OUTCOME_UNKNOWN`; the worker does not blindly resend. Restart converts interrupted dispatches to unknown and runs provider-specific reconciliation. Confirmed failure and rejected authorization remain distinct states.

This reduces duplicate risk but does not claim atomic exactly-once behavior across SQLite and external providers.

## Product recovery

ReportDesk customer and probe sessions call the same export implementation. Only customer sessions sign outcome events. The web callback verifies the HMAC, customer actor, event freshness, case/tenant, workflow, latest passing verification, and manifest/app/config revisions. Event IDs are unique. A valid successful event marks recovery observed while final provider synchronization remains pending.

## Evaluation

The checker reads captured records and provider effects outside the agent path. Common checks cover forbidden effects, tenant access, evidence support, environment labels, logical deduplication, confirmed effects, exact approval correspondence, passing verification, and signed recovery.

Scenario checks cover distractors and completion (E01), failure plus human fix ordering (E02), authoritative identity clarification (E03), injected source content with preserved scope (E04), reconcilable and intentionally unresolvable lost-response branches without resend (E05), and rejected duplicate plus stale/edited approvals with one authorized send (E06).

Unit tests create temporary `LOCAL FIXTURE` artifacts to validate checker behavior and the 18-file runner. They are not benchmark results. Real verdicts require independently captured state, an evaluator-only outcome secret, and three frozen trials for every scenario.

## Verification status on 2026-09-13

- `pnpm lint`: passed locally.
- `pnpm typecheck`: passed locally.
- `pnpm test`: passed locally.
- `node --test apps/web/src/server/*.test.ts`: passed locally.
- `pnpm build`: passed locally.
- `pnpm smoke:providers` with all modes `local_fixture`: passed and printed `LOCAL FIXTURE` for all reads and writes.
- Live Gmail/GitHub/Slack provider smoke: `NOT RUN`, credentials and controlled IDs absent.
- Real OpenAI/Lemma traced turn: `NOT RUN`, model and Lemma configuration absent.
- E01–E06 final 18-trial suite: `NOT RUN`, captured artifacts and evaluator outcome secret absent.

## Operational limitations

The worker library is restart-safe for persisted actions, but a daemon consuming the API's `case_jobs` table is not implemented. Provider reconciler coverage must be supplied for every production write kind. The current demo uses one organization, one mailbox, one repository, one Slack workspace, and a controlled fixture manifest. SQLite deployment requires one persistent host. No live integration, trace, or evaluation metric should be published until its corresponding command completes against controlled external state.
