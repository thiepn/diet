# P13 — Post-Release Production Monitoring, Telemetry & Reliability Hardening

Date: 2026-09-29. Release: Diet Copilot Web 2.0.1.

## Objective

Keep the P12 production cutover observable without turning a private nutrition application into a tracking product.

P13 adds three layers:

1. **Local operational telemetry** — a bounded seven-day ring buffer of sanitized runtime events stored only in the current browser.
2. **System Health diagnostics** — an in-app view that exposes data state, Realtime state, service-worker state, write safety and recent sanitized events.
3. **External synthetic monitoring** — an hourly GitHub Actions probe of the public production shell, PWA assets and Supabase Auth health endpoint.

## Privacy boundary

P13 telemetry must never send or store nutrition records, meal names, weight values, email addresses, auth tokens, OAuth codes, request IDs, free-form user text or Copilot messages.

Allowed telemetry is operational metadata such as event type, state name, RPC operation name, duration, retry flag, connectivity, service-worker readiness and sanitized error code/name. Local telemetry is capped at 120 events and seven days.

No third-party analytics SDK is introduced.

## Reliability hardening

- Data refreshes emit duration/outcome telemetry.
- Auth lifecycle transitions are observable without recording identity.
- Write retries, failures and uncertain-write blocks are observable without arguments or request IDs.
- Realtime channel status is tracked.
- Foreground/pageshow revalidation refreshes stale data after the app resumes.
- PWA registration/update failures surface in diagnostics.
- The service worker precaches the telemetry module so offline diagnostics still load.
- Existing explicit-write and uncertain-write safeguards remain authoritative.

## Synthetic monitor

The hourly monitor checks:

- canonical `/diet/` is stable Diet Copilot 2.0 and contains no RC marker;
- manifest remains standalone;
- P13 production service worker is live;
- the telemetry module is publicly available and precached;
- Supabase Auth `/auth/v1/health` returns a healthy GoTrue response using the publishable key.

The monitor records latency as evidence but does not fail on a fragile latency threshold. Timeout or invalid production state fails the workflow.

## Operator checks

After a deployment or reported incident:

1. Review the P13 synthetic workflow and browser certification.
2. Use Supabase Health Check Advisors and the Logs Explorer/MCP detection queries to compare current errors with a known-good window.
3. Check API/Auth 5xx rates, 401/403 changes, Postgres connection pressure and relevant advisor findings.
4. Use the in-app System Health diagnostics to distinguish local storage/PWA/write-guard problems from backend failures.
5. Fix the smallest identified cause, then rerun the same detection check.

## Baseline on P13 start

The initial 24-hour project log sample showed no sampled 5xx responses and no sampled 401/403 responses in the queried edge/Postgres streams. This is a baseline, not a permanent guarantee.

Supabase advisors also report shared-project findings outside Diet. Existing Diet write RPCs are intentionally authenticated write boundaries; P13 does not change SECURITY DEFINER semantics without a dedicated authorization audit.
