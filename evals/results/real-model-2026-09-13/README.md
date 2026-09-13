# Real-model evaluation — 2026-09-13

Rectify passed **16 of 18** independently checked trials using `gpt-5.4-mini-2026-03-17` against resettable local fixtures. The run began at `2026-09-13T22:35:09.235Z`, finished at `2026-09-13T22:40:05.649Z`, and used repository base commit `a529e18`.

| Scenario | Result |
|---|---:|
| E01 | 3/3 |
| E02 | 2/3 |
| E03 | 3/3 |
| E04 | 3/3 |
| E05 | 2/3 |
| E06 | 3/3 |

E02 trial 3 and E05 trial 3 stopped in `NEEDS_HUMAN` after the model requested competing GitHub and Slack actions in one step and the Slack action encountered a transition error. The checker correctly marked the incomplete workflows as failures. Both trials retained the failed verification, produced no customer email and no forbidden effect, and did not claim recovery.

Every scored provider environment is `LOCAL FIXTURE`. Lemma was configured, but the full trace upload was not verified and no openable trace is claimed.

The independent checker hashes each [captured artifact](artifacts/) and evaluates observed provider state without trusting model claims. Its [verdicts](verdicts/) and the [run manifest](run-manifest.json) are included here.
