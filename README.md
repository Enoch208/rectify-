# Rectify

Rectify coordinates a customer CSV-export complaint across Gmail, GitHub, Slack, and the ReportDesk demo product without confusing a closed engineering issue with customer recovery.

## Current status

- Contracts, SQLite action/case persistence, exact CSV verification, provider adapters, bounded agent turns, approval binding, authenticated APIs, and the independent evaluator are implemented and locally tested.
- The provider smoke command succeeds in explicitly labelled `LOCAL FIXTURE` mode. This is not a provider integration result.
- Live Gmail, GitHub, and Slack reads/writes are `NOT RUN` because the required credentials and controlled resource IDs are absent.
- A real OpenAI turn and openable Lemma trace are `NOT RUN` because their configuration is absent.
- The final E01–E06 evaluation is `NOT RUN` because no independently captured 18-trial artifact set or evaluator outcome secret is available.

See [System and reliability](docs/SYSTEM_AND_RELIABILITY.md) and the [redacted run manifest](evals/final-run-manifest.redacted.json) for boundaries and evidence status.

## Requirements

- Node 24 or newer
- pnpm 10.33.0
- A persistent filesystem for SQLite
- Controlled provider accounts before using `live` mode

Install dependencies:

```sh
pnpm install --frozen-lockfile
```

Export the required variables from `.env.example` through the shell or deployment secret manager. The repository does not load the root example file automatically and no credential file should be committed.

`RECTIFY_INTAKE_DIRECTORY_JSON` is a JSON array with trusted entries shaped like this:

```json
[
  {
    "gmailThreadId": "controlled-thread-id",
    "organizationId": "controlled-organization-id",
    "tenantId": "controlled-tenant-id",
    "contactId": "controlled-contact-id",
    "contactEmail": "controlled-recipient@example.test"
  }
]
```

Set `RECTIFY_DB_PATH` to an explicit file in a persistent directory. Set each provider mode to exactly `live`, `arga`, or `local_fixture`; missing or invalid credentials never fall back to fixtures. Set `REPORTDESK_ENVIRONMENT` to one of the display labels defined by `@rectify/core`.

Start the web and ReportDesk processes after exporting configuration:

```sh
pnpm --filter @rectify/reportdesk dev
pnpm --filter @rectify/web dev
```

Open `/sign-in` and enter `RECTIFY_OPERATOR_TOKEN`. The session endpoint validates it in constant time and sets an HttpOnly, same-site operator cookie. Operator case and run routes reject absent or invalid sessions with JSON errors.

## Verification

```sh
pnpm lint
pnpm typecheck
pnpm test
node --test apps/web/src/server/*.test.ts
pnpm build
```

The provider smoke command performs one real read and one real write per provider. In `live` mode it creates a Gmail draft, a GitHub issue, and a Slack message:

```sh
pnpm smoke:providers
```

Live smoke requires `GMAIL_ACCESS_TOKEN`, `GMAIL_THREAD_ID`, `GMAIL_SMOKE_TO`, `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_READ_ISSUE_NUMBER`, `SLACK_TOKEN`, and `SLACK_CHANNEL_ID`. A real traced agent turn additionally requires `OPENAI_API_KEY`, `RECTIFY_MODEL_ID`, `LEMMA_API_KEY`, `LEMMA_PROJECT_ID`, and `LEMMA_RELEASE`.

For a local adapter-only check, explicitly set all three modes to `local_fixture` and provide the non-secret fixture IDs listed in `.env.example`. Its output is labelled `LOCAL FIXTURE`.

## Independent evaluation

The evaluator expects these files in `RECTIFY_EVAL_ARTIFACT_DIR`:

```text
E01-trial-1.json through E01-trial-3.json
...
E06-trial-1.json through E06-trial-3.json
```

Each artifact must satisfy the schema in `evals/src/schema.ts` and contain captured application/provider state. The checker ignores agent-authored success claims and verifies provider effects, tenant scope, evidence, approvals, signed outcome events, deduplication, and scenario-specific safety outcomes.

Set a new empty `RECTIFY_EVAL_RESULTS_DIR` and the evaluator-only `RECTIFY_EVAL_OUTCOME_SECRET`, then run:

```sh
pnpm eval
```

The command requires all 18 artifacts before writing verdicts and refuses to overwrite earlier verdict files.

## Known limitations

- The checked-in worker provides restart-safe action dispatch and reconciliation, but there is not yet a long-running process consuming the web API's persisted case-job queue.
- Live provider smoke, a real model turn, an openable Lemma trace, and final scenario metrics remain unverified until credentials and controlled artifacts are supplied.
- ReportDesk is a controlled demo product, not a claim of arbitrary production-product verification.
- SQLite requires a single persistent host; use a persistent volume rather than adding a second database system.
