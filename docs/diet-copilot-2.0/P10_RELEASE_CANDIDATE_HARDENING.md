# Diet Copilot 2.0 — P10 Full Adversarial Product Audit & Release-Candidate Hardening

Status: **implemented on \`diet-copilot-2.0\`**

P10 treats P1–P9 as a release candidate and attempts to break the product instead of adding another feature layer.

The audit focused on authentication/session invalidation, offline/reconnect behavior, owner-cache isolation, write idempotency and uncertain network outcomes, long-lived account data volume, PWA install/offline isolation, Copilot/AI boundaries, destructive actions, accessibility semantics, mobile density, malformed/future data, and deterministic deployment artifacts.

> **When Diet Copilot cannot prove that private state or a write result is safe, it fails closed and requires reconciliation rather than guessing.**

## Release-blocking findings fixed

### 1. Rejected sessions could expose cached private data

Before P10, an online \`auth.getUser()\` failure could reach the generic stale-cache path. That is valid for a network outage, but not for a server-rejected session.

P10 now treats definitive auth failures separately. A rejected/invalid session causes best-effort local sign-out, removal of persisted V2 auth state, clearing of the in-memory private model, and a signed-out UI. Cached nutrition is never rendered after a definitive auth rejection.

The same fail-closed behavior applies when \`auth.getSession()\` itself reports a definitive authentication failure.

Canonical classifier: \`src/engine/release-guards.mjs\`  
Browser mirror: \`v2/engine/release-guards.mjs\`  
Version: \`1.0.0-p10\`

### 2. Ambiguous network writes could lead to duplicate manual retries

The existing write layer already reused the same request ID for its automatic retry. P10 closes the remaining failure case where both responses are lost after the server may already have committed.

After two transient failures for the same request ID, the client marks the outcome uncertain and throws \`DIET_WRITE_UNCERTAIN\`. Every later mutation is blocked with \`DIET_WRITE_RECONCILE_REQUIRED\` until a successful live refresh reconciles canonical state.

This prevents a second user click from creating a fresh request ID before the original outcome is known.

### 3. Long account histories could be silently truncated

Canonical history reads now use deterministic pagination through \`fetchPagedRows(...)\`.

Paginated tables:

- daily logs
- meals
- meal items
- weight entries
- goal phases
- saved foods
- saved meals

Pagination uses explicit ordering, stable tie breakers, 1,000-row ranges, and a 50-page safety cap. Exceeding the cap fails loudly instead of silently presenting incomplete history.

Purposefully bounded operational data remains bounded: latest 20 strategy recommendations, latest 120 activity days, and latest 180 training-day records.

### 4. Full cloud history could exceed localStorage quota

Cloud history and P9 JSON export remain complete. The offline convenience snapshot is now intentionally bounded.

Cache: \`diet-copilot-v2-read-cache-v2\`  
Offline history window: **400 days**

The snapshot keeps recent logs/meals/items/weights plus reusable foods, saved meals, goal phases, strategy recommendations, activity, training settings and recent training days.

### 5. V2 did not have an independently scoped PWA

P10 adds:

- \`v2/manifest.webmanifest\`
- \`v2/sw.js\`
- \`v2/pwa.js\`

V2 uses scope \`./\`, starts at \`./#today\`, and installs as a standalone app. Its worker caches the public V2 shell/modules only; it does not cache Supabase data, private API responses, or Copilot responses.

### 6. V1 and V2 service workers could interfere

The root v1 worker now cleans only \`diet-copilot-web-*\` caches. The V2 worker cleans only \`diet-copilot-v2-*\` caches.

The v1 worker also explicitly ignores all \`/v2/\` requests, preventing it from substituting the v1 offline shell while service-worker control is transitioning.

### 7. Corrupted fallback auth cookies could resurrect stale local auth

Once the resilient auth-cookie manifest exists, it is now authoritative. If the cookie set is corrupt/incomplete, V2 fails closed and removes stale local auth storage instead of falling back to an older token.

Dedicated tests cover normal localStorage, blocked/quota/silent storage, cookie fallback, stale local-vs-cookie precedence, corrupted authoritative cookies, logout, and multi-chunk Unicode session data.

### 8. PWA precache version could remain stale

The final P10 service-worker cache generation is:

\`diet-copilot-v2-rc-p10-final-1\`

This forces installed V2 clients to replace earlier P10 precaches with the final release-candidate bundle.

## Accessibility and mobile findings fixed

Every V2 native \`<dialog>\` now has an accessible name through \`aria-labelledby\`.

Decorative More-card glyphs/arrows are hidden from assistive technology.

The V2 viewport does not disable pinch/browser zoom.

The five Food shortcut actions no longer become three toolbar rows on mobile. They use one compact horizontally scrollable row. The five-item primary mobile navigation remains one line.

System and explicit reduced-motion behavior remains supported.

## Malformed and large-data resilience

The P10 synthetic stress fixture contains roughly two years of history, hundreds of weigh-ins, activity data, malformed values, invalid dates and future rows.

The read model must continue to produce finite current-state calculations and exclude invalid/future data from current results.

## Destructive-action review

Existing safeguards remain intact:

- logged meal deletion: confirmation + optimistic concurrency
- saved food deletion: confirmation + existing log history preserved
- saved meal deletion: confirmation + existing logs preserved
- major strategy transition: explicit confirmation
- strategy revert: explicit confirmation and history preservation
- Copilot writes: proposal only, explicit user confirmation, existing secure write API

P10 does not broaden any mutation authority.

## AI/Copilot boundary

P8's existing protections remain enforced: authenticated broker, no model DB credential, no direct AI writes, exact candidate validation, trusted evidence-key resolution, unknown-food refusal, modified-meal refusal, comparison-vs-logging distinction, session-only chat history and explicit write confirmation.

## New tests

P10 adds:

- \`tests/p10-auth-storage.mjs\`
- \`tests/p10-adversarial.mjs\`

Coverage includes authentication failure classification, fail-closed source contracts, same-request-ID retry, uncertain-write lockout/reconciliation, multi-year history, malformed/future rows, pagination contracts, bounded offline cache, V1/V2 service-worker isolation, V2 PWA install/offline behavior, canonical/browser guard parity, dialog naming, zoom availability, decorative semantics, mobile one-row navigation/shortcuts, and reduced motion.

Existing P2.5/P3 source tests were updated to require the new complete paginated reads.

## Database contract

\`supabase/tests/p10_release_candidate_contract.sql\` asserts:

- exact same 18 authenticated \`diet_app_*\` RPCs
- zero anonymous \`diet_app_*\` execution
- zero direct authenticated writes to protected Diet tables
- legacy privileged AI mutation functions remain unavailable to the browser
- no new release/cache/write-guard persistence table

Expected live result:

\`diet_p10_release_candidate_contract_ok\`

## Release-candidate identity

The V2 shell now identifies itself as **Diet Copilot 2.0 RC**.

Runtime marker: \`2.0.0-p10-rc\`

Production v1 remains production until a later deliberate release/migration phase.

## Audit limitations

P10 provides adversarial source, deterministic-engine, CI, database-contract and built-site certification. It does not claim a real-device visual/browser audit because this feature branch is built by CI but is not currently exposed as a separately controllable deployed preview.

Before replacing v1, keep these as separate runtime/device certification gates:

- Android real-device installation/update
- real Health Connect permission/sync
- installed-PWA update/offline/restore on Chrome/Android
- Safari/iOS PWA smoke test if needed
- keyboard-only browser pass
- screen-reader smoke test
- narrow/large-font visual inspection
- remote P8 inference with the actual production provider secret

These are runtime/device verification items rather than known source defects.

## Result

\`\`\`text
invalid auth        → private data hidden
network outage      → owner-matched cache allowed
uncertain write     → future writes blocked until refresh
large cloud history → paginated, complete read
offline snapshot    → deliberately bounded
V1 service worker   → cannot own/fallback V2
V2 service worker   → V2 shell only
AI                  → explanation/proposal, never authority
database authority  → unchanged 18-RPC allowlist
\`\`\`

P10 moves Diet Copilot 2.0 from feature-complete preview to a hardened release candidate.
