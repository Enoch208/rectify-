# System and reliability brief

## User and workflow

The operator is a support engineer at a small B2B software company. A customer reports that a workflow is broken. Engineering may already have closed the related issue. Rectify's job is to check whether that customer's workflow works, carry any remaining failure to engineering, send the customer only a message a human approved for a verified state, and confirm recovery from the product rather than from anyone's narrative.

The case state machine is `NEW → INVESTIGATING → WAITING_ENGINEERING → (recheck) → READY_FOR_APPROVAL → WAITING_CUSTOMER → RECOVERED`, with `NEEDS_HUMAN` reachable from any step with a reason and a resume point. Engineering state, latest verification, notification state, recovery and synchronization are separate fields, never inferred from the label.

## Model versus policy

The model interprets untrusted content and chooses among narrow tools: read the case's own Gmail thread, list and read repository issues, select the matching issue, read the engineering Slack channel, run the export check, and propose an engineering handoff. Every tool is scoped to the active case and tenant. The model never writes provider content and cannot pick a tenant, recipient, repository, channel or approval.

After the turn, server code decides the next state from stored evidence: no grounded issue or no check means `NEEDS_HUMAN`; a failed check requires a confirmed impact issue and Slack handoff before `WAITING_ENGINEERING`; an inconclusive check stops for a human; a passing check prepares a draft and an approval request. Rechecks are deterministic and do not call the model.

Without model configuration an investigation stops for a human and says why. It never falls back to a scripted answer.

## Provider actions

| Provider | Writes | Reconciliation after an ambiguous response |
|---|---|---|
| GitHub | Customer-impact issue on a failed check; recovery comment on the impact issue or matched issue | Exactly one issue or comment carrying the action marker |
| Slack | Engineering handoff; approval request with Approve and Reject buttons; recovery reply in the handoff thread | Exactly one message carrying the action marker |
| Gmail | Customer draft; send of the approved content | Draft with the `X-Rectify-Action` header; sent message found by its `Message-ID` |

Every write has a unique logical key and an immutable payload in the action ledger, and is recorded `DISPATCHING` before the provider call. A lost response becomes `OUTCOME_UNKNOWN`. On start and every 30 seconds the worker runs provider-specific reconcilers. Finding the effect confirms the original action; finding nothing is never treated as proof that nothing happened, so the action stays `OUTCOME_UNKNOWN` and the case waits for a human. Unambiguous confirmed failures of recovery updates retry under new logical keys, at most three times.

## Approval and customer send

The approval request binds the case version, organization and tenant, send action version and payload hash, provider account, draft and thread, sender, the single trusted recipient, subject, body, stored MIME, business-field hash, verification, application and configuration revisions, policy version, Slack workspace, channel, message and nonce, and a five-minute expiry.

The Slack interaction is verified over the raw body with a five-minute timestamp window and a constant-time signature comparison, then bound to the stored workspace, channel, message, allowlisted approver and nonce. An already-decided approval is rejected.

Before dispatch the worker re-reads the Gmail draft, the product's current configuration revision and the trusted directory, and the send policy checks every bound field plus a fresh matching passing verification and no later contradictory check. The approval is marked used in the same authorization step, and the worker sends the stored approved content rather than whatever the draft now contains. A changed draft, stale or expired approval, changed configuration or reused approval rejects the send and returns the case to a human. A rejected decision or an expired pending approval does the same.

## Recovery

ReportDesk's customer page and Rectify's probe call the same export implementation. Only a customer session signs an outcome event, and ReportDesk delivers it to Rectify even if the export page is closed, recording each delivery attempt. Rectify accepts the event only with a valid signature, a customer actor, a fresh timestamp, the case's tenant, the latest passing verification's revisions, and a unique event ID. The case becomes `RECOVERED` with synchronization `PENDING`; synchronization becomes `COMPLETE` only after the GitHub and Slack recovery updates are confirmed.

## Identity and scope

A case opens only for a Gmail thread in the trusted intake directory. A thread that maps to more than one tenant returns the candidates and requires an operator choice, which is recorded and reused. Operator routes require a constant-time checked token via an HttpOnly, `SameSite=Strict` session cookie or bearer header. ReportDesk and Slack callbacks use their own signed boundaries.

## Evaluation method

The scenario runner creates a fresh store, fixture providers and ReportDesk for every trial, drives E01–E06 through the real worker loop, approval binding and customer export, and captures the resulting provider effects from provider state rather than from the ledger or the agent. The independent checker grades forbidden effects, tenant scope, evidence support, deduplication, confirmed effects, approval correspondence, verification truth, signed recovery, and scenario outcomes: distractors (E01), failure then human fix before send (E02), operator clarification (E03), injected instructions (E04), reconcilable and unresolvable lost responses without resend (E05), and rejected duplicate and edited approvals with exactly one send (E06).

Tests run the same harness with scripted models. They validate the harness and checker; they are not benchmark results. The runner refuses to produce artifacts without a real model.

## Verification status

- Lint, typecheck, unit and integration tests, and the web build pass locally on the committed code.
- End-to-end pipeline test: the Northstar loop from complaint to completed synchronization passes with fixture providers, the real SQLite store, the real ReportDesk server and a scripted model.
- Reliability tests pass: lost send reconciled after restart without resend, unresolvable send held, edited draft blocked, expired approval, missing model, ambiguous identity.
- The three processes were started together locally with fixture providers: a queued investigation was processed by the worker and stopped for a human because no model was configured.
- Live Gmail, GitHub and Slack smoke: passed one read, write and read-back per provider. Gmail created draft `r-5347421653066028640` without sending it, GitHub created [issue 5](https://github.com/Enoch208/reportdesk-app/issues/5), and Slack created message `1789339485.087939`. Every effect was labelled `LIVE PROVIDER`; the [redacted receipt](live-provider-smoke-2026-09-13.json) contains no credentials.
- Real model walkthrough: passed with `gpt-5.4-mini-2026-03-17`, 10 tool calls in 21.691 seconds; the recorded Northstar case reached `RECOVERED` with synchronization `COMPLETE` using local fixture providers.
- Openable Lemma trace: not verified. A minimal SDK smoke reached Lemma with HTTP 201 and `enqueued`, but full 17-span agent uploads failed with `fetch failed` before acknowledgment.
- Final E01–E06 × 3 evaluation: 16/18 independently checked fixture trials passed with `gpt-5.4-mini-2026-03-17`. E02 trial 3 and E05 trial 3 safely stopped in `NEEDS_HUMAN` after an action transition error; neither sent customer email nor produced a forbidden effect. [Artifacts and verdicts](../evals/results/real-model-2026-09-13/README.md) are committed.
- Arga twins: `NOT RUN`.
- Docker image build and three-process runtime smoke: passed locally, including case persistence across a container restart.

## Known limitations

One workflow, organization, mailbox, repository and Slack channel. ReportDesk keeps configuration in memory. Reconciliation windows are bounded (50 issues, 100 comments, 100 Slack messages); anything outside stays held for a human. The scenario runner resets only fixture providers. SQLite requires a single persistent host shared by the web app and the worker. None of this is a claim of exactly-once delivery across SQLite and external providers, arbitrary-product verification, or universal prompt-injection resistance.
