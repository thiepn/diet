# P24 — Controlled PostgreSQL 17.11 Upgrade Execution

P24 is currently **prepared but not completed**.

The active operations release remains **P23.0** until the managed Supabase PostgreSQL upgrade has actually completed and all post-upgrade checks pass.

## Why execution is manual

The connected Supabase automation surface exposes SQL, migrations, Edge Functions, project pause/restore and project metadata, but it does not expose the hosted **Infrastructure → Upgrade project** operation.

Supabase recommends the managed in-place `pg_upgrade` path for this project. P24 therefore does not substitute pause/restore or ad-hoc SQL for the managed upgrade.

## Concurrent-change protection

P24 observed live shared-platform changes during preparation:

- Gomoku P4 schema migration
- Gomoku P5 schema migration
- Gomoku room Edge Function deployments through version 18

A service-only gate now prevents a stale baseline from being treated as upgrade-ready.

`private.platform_p24_execution_gate()` requires:

- P23 preflight pass;
- current schema SHA equals latest passing P23 certification;
- current PostgreSQL is still below 17.11;
- no shared migration in the previous 10 minutes;
- Diet write freeze is currently off.

The public-named wrapper `public.platform_p24_execution_status()` is executable only by `service_role`.

## Current refreshed baseline

Shared schema SHA:

`f5485033a2845f9a1baacee6811c976c72e5ffb5d73bf0b9a50e3d0c0b48647c`

Current database:

- PostgreSQL 17.6
- P23 preflight pass
- zero detected 17.11 hazards
- eight active cron jobs
- eleven Edge Functions
- Gomoku: five relations, two functions
- platform-control functions: eight

## Recovery evidence

During the P24 maintenance attempt a fresh Diet recovery snapshot was captured and verified:

- hash valid;
- schema valid;
- row counts match;
- restore plan safe to stage;
- destructive restore is not automatic.

The latest encrypted off-site backup workflow on the P23 production head also completed successfully.

Diet was briefly placed into the P21 write freeze for the intended upgrade window. Once it became clear the hosted upgrade operation could not be initiated from the connector, the freeze was removed and P21/P22 returned to pass.

## Manual execution step

Only after `private.platform_p24_execution_gate()` returns `readyForManualUpgrade=true`:

1. Confirm the database execution gate is ready.
2. Re-list all Edge Functions and confirm at least 10 quiet minutes with no unexplained version/hash changes.
3. Open the Supabase project.
4. Go to **Project Settings → Infrastructure**.
5. Select **Upgrade project**.
6. Use the managed in-place PostgreSQL upgrade to 17.11.
7. Keep the shared application maintenance window active.
8. Immediately return to the P24 post-upgrade validation procedure.

Do not use Pause/Restore as a substitute for this in-place upgrade.

## After the Dashboard upgrade

Run:

`private.platform_p23_post_upgrade_validation()`

It must report:

- PostgreSQL 17.11 or newer;
- exact shared-schema fingerprint match;
- P23 preflight pass.

Then validate Auth, platform-health, Account, Diet, Notes, TMS60, WTTN, Wordstrike, Gomoku, Leaderboard, Micro Arcade, Canvas, Edge Functions and cron.

P24 is complete only after all of those pass and any temporary write freeze is removed.
