# Diet Copilot 2.0.3 — P19 concurrency/idempotency gates

Date: 2026-09-29.

| Gate | Coverage |
| --- | --- |
| CI | P13–P18 regressions plus P19 concurrency/idempotency contract |
| A7 | combined operations/security/resilience/performance/privacy/integrity/concurrency invariants |
| A8 | Google-only Account consumer contract under P19 operations metadata |
| A9 | Account Platform v1 consumer release remains Web 2.0.3 |
| P19 static | request ledger, payload hashing, owner lock, wrapper/core split, retention, no stale auto-merge |
| P19 public probe | publishable/anonymous client cannot execute operational concurrency status |
| Live DB | exact replay, payload collision rejection, operation collision rejection, stale-write rejection |
| RPC surface | 18 public wrappers / 18 private cores; authenticated has zero private-core grants |
| Cron | exactly one daily 03:27 UTC request-ledger prune job |
| Advisors | no P19-specific security or performance finding |
| P14–P18 | all previous production hardening contracts remain green |

## P19 invariants

- Public write RPC names and signatures remain compatible.
- Every authenticated mutation is claimed transactionally before its private core executes.
- Request identity is bound to owner + request ID + operation + canonical payload hash.
- Exact retries return the stored committed result without repeating the mutation.
- Same-ID payload or operation changes are rejected.
- Mutations for one owner are serialized with a transaction advisory lock.
- Stale content edits are rejected through existing `expected_updated_at` checks.
- No stale-content auto-merge is introduced.
- Explicit boolean state setters remain deterministic serialized last-write-wins operations.
- The private request ledger is inaccessible to browser roles and retained for 35 days.
- P19 operational status is service-role only.
- Web/PWA remains 2.0.3 with the existing P17 cache namespace.
