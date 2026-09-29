# Diet Copilot 2.0.1 — P13 production reliability gates

Date: 2026-09-29. Phase: P13 Post-Release Production Monitoring, Telemetry & Reliability Hardening.

## Required gates

| Gate | Coverage |
| --- | --- |
| CI | P13 syntax, telemetry privacy contract, product/backend metadata and built Pages artifact |
| A7/P13 operations | degraded-mode behavior, explicit write safety, Realtime/foreground reliability and no broad local-data clearing |
| A8 account consumer | Google-only PKCE, canonical project, shared persistent auth storage and P13 release metadata |
| A9 account platform | Account Platform v1 contract with Diet consumer release 2.0.1 |
| P13 synthetic | canonical shell, standalone manifest, P13 worker/telemetry asset, Supabase Auth health |
| P13 live browsers | Chromium, Firefox and WebKit canonical production, System Health diagnostics, mobile layout and runtime errors |
| Hourly monitor | lightweight public-shell/Auth health probe with JSON evidence |

## Telemetry privacy contract

Operational telemetry is local-only. It is limited to sanitized event names, state names, operation names, timings, retry flags, connectivity, worker state and sanitized error codes. It never intentionally records nutrition values, meals, weights, email addresses, tokens, OAuth codes, request IDs or free-form user content.

The local log retains at most 120 events for seven days. Clearing System Health history deletes the browser copy.

## Reliability invariants

- Network failures do not become sign-outs.
- Cached owner-scoped data remains usable when live refresh fails.
- An uncertain write blocks subsequent writes until canonical refresh/reconciliation.
- Foreground resume revalidates signed-in data when the last fetch is older than one minute.
- Realtime status is observable but does not become the authority for nutrition data.
- Root and `/v2/` workers remain separate scopes.
- OAuth callback/result URLs are not cached.
- V1 rollback remains available.

## Production monitoring

The hourly synthetic monitor deliberately avoids real account credentials. It verifies the public shell/PWA and the documented Supabase Auth health endpoint using the public publishable key. Real authenticated data flows remain covered by owner-scoped application contracts and release-browser fixtures rather than production impersonation.

For backend incidents, compare Supabase API/Auth error rates and connection pressure with a known-good window and review Health Check Advisors before changing database behavior.
