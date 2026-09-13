# Real-model evaluation after the concurrency fix — 2026-09-13

Rectify passed **18 of 18** independently checked trials using `gpt-5.4-mini-2026-03-17` against resettable local fixtures. The run began at `2026-09-13T22:47:22.736Z`, finished at `2026-09-13T22:52:04.358Z`, and used repository commit `f5af3f2` with prompt revision `investigation-prompt-v1`.

| Scenario | Result |
|---|---:|
| E01 | 3/3 |
| E02 | 3/3 |
| E03 | 3/3 |
| E04 | 3/3 |
| E05 | 3/3 |
| E06 | 3/3 |

## What changed since the first run

The [first run](../real-model-2026-09-13/README.md) passed 16/18. Both failures had one cause: the model requested the customer-impact issue and the Slack handoff in the same step, the two tool calls tried to authorize the same ledger action at once, and one received a transition error. The model then escalated to a human even though the handoff had been confirmed.

Commit `f5af3f2` makes concurrent requests for one logical action share the single running execution. A deterministic test (`apps/worker/test/concurrent-handoff.test.ts`) reproduced the exact transition error before the fix and passes after it. No scenario, checker rule or expectation was changed between the runs, and the first run is kept unchanged.

Every scored provider environment is `LOCAL FIXTURE`. These are three trials per scenario, not a claim about behaviour beyond these frozen scenarios.

The [captured artifacts](artifacts/), [verdicts](verdicts/), [run manifest](run-manifest.json) and [console output](console.log) are included here.
