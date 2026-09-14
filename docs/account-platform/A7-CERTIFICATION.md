# A7 — Operations, Observability & Recovery

**Consumer:** Diet Copilot  
**Operations contract:** A7.1  
**Implementation state:** implemented on `a7-operations-observability-recovery`; certification in progress

## Operational behavior

- The dashboard remains read-only; ChatGPT/backend write semantics and idempotent request IDs are unchanged.
- A7 observes refresh/network state without owning identity or data transport.
- Operational logs are redacted to event, operation ID, failure category/status, duration, online/cloud state, release and safe error class.
- No access/refresh tokens, email addresses, meal/weight/goal content or request bodies are logged.
- Offline/backend failure does not call sign-out, clear the canonical session, clear browser storage or discard the cached dashboard snapshot.
- `window.DietOperations.snapshot()` exposes non-sensitive diagnostics for operators/tests.

## Degraded mode

Diet's degraded contract is `cached-read-only`: preserve the last trustworthy snapshot and report backend/network problems separately from authentication state. A stale cache must not be represented as freshly fetched data.

## Idempotency

The existing canonical backend contract requires stable unique `p_request_id` values for ChatGPT writes and prohibits dual writes. A7 does not introduce a second write path.

## Legacy backend

Project `mrrqsqawwxwebsdmrnre` remains **rollback-only**. It must not receive production Diet reads/writes and must not be deleted until central retirement gates pass.

## Certification matrix

| Check | Status |
| --- | --- |
| Redacted operational event layer | PASS |
| Network/auth/service taxonomy available | PASS |
| Dashboard remains read-only | PASS |
| Backend failure does not force logout | PASS by implementation; CI contract pending |
| Cached state preserved | PASS by implementation; production smoke pending |
| Stable request-ID backend contract | PASS existing contract |
| No legacy project runtime reference | PENDING A7 PR CI |
| PWA includes A7 operational layer | PENDING A7 PR CI |
| Production shell synthetic check | PENDING central A7 monitor |
| Real signed-in production refresh/account smoke | MANUAL REQUIRED |
| Legacy backend pause/delete | BLOCKED until live gates pass |

## Verdict

**NOT CERTIFIED — branch CI, central synthetic monitoring and signed-in production smoke must complete.**
