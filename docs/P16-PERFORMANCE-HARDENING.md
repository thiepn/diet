# P16 — Production Performance, Scalability & Resource-Efficiency Hardening

Date: 2026-09-29. Browser release: Web 2.0.2.

P16 changes transport and query efficiency only. Nutrition calculations, coaching rules, food data semantics, P14 authorization, and P15 recovery behavior remain unchanged.

## Production findings

Before P16, a normal signed-in refresh executed 12 separate Supabase Data API reads. RLS kept those reads secure, but most client queries did not include an explicit owner predicate. Supabase's current RLS performance guidance recommends adding the same owner filter to client queries because it gives PostgreSQL a better plan even when the policy already enforces ownership.

The current production dataset contains 281 protected Diet rows. A measured authenticated P16 snapshot call completed in 21.432 ms inside PostgreSQL with all blocks served from shared cache. P16 targets network/request reduction rather than claiming the consolidated SQL itself is faster than each individual small query.

## Consolidated owner snapshot

`public.diet_app_read_snapshot()` now returns the exact read shape required by Diet 2.0 in one RPC:

- profile
- daily logs
- meals
- meal items
- weights
- goal phases
- saved foods
- saved meals
- latest strategy recommendations
- recent activity
- training-distribution settings
- recent training days

Security properties:

- `SECURITY INVOKER`, never definer;
- empty `search_path`;
- explicit `auth.uid()` ownership predicates;
- anonymous Auth identities rejected;
- `anon` has no EXECUTE;
- `authenticated` can execute;
- P14 RLS remains authoritative underneath the function.

The browser therefore goes from 12 normal data requests to 1.

## Compatibility fallback

If a deployment mismatch temporarily makes the snapshot RPC unavailable with `PGRST202`, the browser falls back to the original multi-query loader. P16 hardens that fallback by applying `.eq('user_id', ownerId)` to every owner table read.

Other RPC/database errors do not silently fall back. They retain the existing P13 degraded-mode behavior so real failures are not hidden.

## Realtime

P16 scopes PostgreSQL change subscriptions to the signed-in owner for INSERT and UPDATE events.

Supabase does not support filters for DELETE Postgres Changes. P16 therefore does not subscribe to broad DELETE events. Diet's own delete actions already perform an explicit safe refresh, and foreground revalidation remains in place for cross-device convergence.

This avoids receiving unrelated delete primary keys and prevents cross-user delete traffic from causing unnecessary refreshes.

## Index strategy

P16 evaluated three additional composite ordering indexes after consolidating the read path. The post-migration Supabase advisor correctly reported that all three were unused by the current production workload. They were therefore removed in migration `20260929201015` rather than kept speculatively.

P16 instead relies on the existing owner/date/relationship indexes plus explicit `user_id` predicates. This follows Supabase's guidance to avoid over-indexing: future indexes should be added only when production query plans demonstrate a need.

Existing P14 ownership and foreign-key indexes remain intact because they also support integrity and authorization relationships.

## PWA/runtime release

Web 2.0.2 bumps both production service-worker cache namespaces to P16 so installed PWAs replace cached P13/P15 runtime bytes:

- `diet-copilot-prod-v2-p16-1`
- `diet-copilot-v2-alias-p16-1`

The application remains visually and functionally Diet Copilot 2.0.

## Performance budget

The P16 static contract caps the raw core HTML/CSS/JS/vendor footprint at 700,000 bytes. This is an uncompressed repository budget, not a claim about network transfer size.

## Verification

P16 certification includes:

1. authenticated live RPC shape verification;
2. catalog verification that the RPC is invoker-security and unavailable to anon;
3. anonymous/publishable-key HTTP denial probe;
4. exact owner predicates in the compatibility fallback;
5. owner-filtered Realtime INSERT/UPDATE subscriptions;
6. P14 security regression;
7. P15 resilience regression;
8. PWA cache-version checks;
9. static asset budget;
10. Supabase advisors after migration.

P16 intentionally does not alter adaptive nutrition calculations or introduce data retention/deletion changes.
