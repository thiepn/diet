# P24 — Controlled PostgreSQL 17.11 Upgrade Execution

P24 is **concurrency-safe but not yet completed**.

The active operations release remains **P23.0** until the managed Supabase PostgreSQL upgrade has actually completed and all post-upgrade checks pass.

## Why execution is manual

The connected Supabase automation surface exposes SQL, migrations, Edge Functions, project metadata and recovery controls, but it does not expose the hosted **Upgrade project** operation.

Supabase's managed upgrade takes the project offline, upgrades the database with `pg_upgrade`, and performs its own eligibility checks. The Dashboard remains authoritative for whether the hosted upgrade can begin.

## Concurrent-change protection

The original P24 handoff became stale because the shared project continued changing. P24 detected and invalidated the stale certification after:

- Gomoku P6 schema work;
- Account backup/deletion fixes;
- Gomoku P7 ranked/rating/matchmaking schema work;
- `gomoku-room` Edge Function deployments through v24.

That is expected behavior. P24 must never treat an old fingerprint as upgrade-ready.

The live `private.platform_p24_execution_gate()` requires:

- P23 preflight pass;
- current schema SHA equals the latest passing shared certification;
- PostgreSQL is still below 17.11;
- no shared migration in the previous 10 minutes;
- Diet write freeze is off.

The public-named wrapper `public.platform_p24_execution_status()` remains service-role only.

## Replication-slot refinement

Supabase Realtime itself can create temporary logical replication slots. P24 now records:

- total replication slots;
- temporary active slots matching Supabase Realtime's managed slot pattern;
- blocking/custom slots.

Only **blocking/custom slots** count as the P23 hazard. Managed Realtime slots are surfaced separately and never override the Supabase Dashboard's own upgrade eligibility check.

This avoids manually dropping active managed Realtime slots while preserving the requirement that any user/persistent logical slot blocks the handoff.

## Current refreshed baseline

Current certified shared SHA:

`8239b32928be652214a63ae733d42bace71d46d7145e3e6e5eea8b7f066e1dfe`

Recorded database state:

- PostgreSQL 17.6
- target PostgreSQL 17.11
- P23 preflight pass
- zero detected 17.11 hazards
- zero blocking replication slots at the latest refresh
- six registered Account apps
- eight active cron jobs
- eleven Edge Functions
- Gomoku: 9 relations / 8 functions
- latest recorded `gomoku-room`: v27
- latest recorded shared migration: `20260930164232_gomoku_p7_ranked_active_opponent_index`

## Recovery evidence

A fresh Diet recovery snapshot was captured and verified at **2026-09-30 20:27:39 UTC**:

- snapshot ID: `aebe85b2-43a4-4e0b-b44d-e782bb97aa18`
- payload hash valid
- Diet schema hash valid
- row counts match
- restore plan reports `safe_to_stage=true`
- destructive restore remains operator-only

The latest encrypted P15 off-site backup on the P24 hardening head succeeded (run `36744693032`). A further metadata-only merge does not replace the requirement to confirm recovery evidence immediately before the hosted upgrade.

## Current authorization state

At 2026-09-30 20:27:45 UTC the live service-only execution gate returned **`ready_for_manual_upgrade`** with an exact schema match and **225.23 minutes** of migration quiet time. The v27 Edge deployment had also been quiet for about **185.63 minutes**.

No write freeze has been enabled yet because the hosted Dashboard action cannot be executed through the connected Supabase tool surface.

## Manual execution step

Do not rely on this document's timestamp alone. Immediately before the Dashboard action:

1. Run `private.platform_p24_execution_gate()`.
2. Require `readyForManualUpgrade=true`.
3. Require `schemaMatchesCertification=true`.
4. Require `preflightStatus=pass`.
5. Require `quietMinutes >= 10`.
6. Re-list all Edge Functions and verify no unexplained deployment occurred during the final quiet window.
7. Confirm the Supabase Dashboard itself shows no upgrade blocker.
8. Enable Diet's P21 write freeze immediately before the hosted operation.
9. Use the managed Dashboard **Upgrade project** action to PostgreSQL 17.11.
10. Keep the maintenance window active until cross-app post-upgrade validation passes.

If any shared migration or Edge deployment lands before the click, refresh the certification instead of overriding the gate.

## After the Dashboard upgrade

Run `private.platform_p23_post_upgrade_validation()` and require:

- PostgreSQL 17.11 or newer;
- exact shared-schema fingerprint match;
- preflight pass.

Then validate Auth, platform-health, Account, Diet, Notes, TMS60, WTTN, Wordstrike, Gomoku, Leaderboard, Micro Arcade, Canvas, Realtime, Edge Functions and cron.

P24 is complete only after the full matrix passes and any temporary write freeze is removed.
