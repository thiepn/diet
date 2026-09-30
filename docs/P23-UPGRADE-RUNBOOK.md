# P23 — PostgreSQL 17.11 Shared-Platform Upgrade Runbook

## Pre-maintenance go/no-go

Do not start the upgrade unless all conditions are true:

1. `private.platform_p23_upgrade_preflight()` returns `status=pass` and `safeToScheduleUpgrade=true`.
2. Current shared-schema SHA equals the certified P23 SHA.
3. P15 encrypted off-site backup is green and a fresh in-database recovery snapshot exists.
4. P18 integrity is clean.
5. P20 Diet schema drift is false.
6. P21 failure certification/readiness is green.
7. P22 maintenance status is pass.
8. The platform-health Edge Function reports Auth + database healthy.
9. No new migration has landed after the operator reviews the P23 baseline without explicit recertification.

## Maintenance window

The actual PostgreSQL upgrade is a shared-platform operation. Expect Auth/database-dependent features across all THIEPN apps to be unavailable during the infrastructure operation.

For Diet, enable the P21 emergency write freeze immediately before the window if the database remains reachable.

Other applications should enter their own maintenance/read-only mode where supported.

## Backup

Immediately before infrastructure change:

- run/verify a new P15 Diet snapshot;
- confirm the encrypted P15 off-site workflow is green;
- preserve the P23 inventory and current shared fingerprint;
- record the latest Supabase migration version;
- record current Edge Function versions/SHA identifiers.

Do not treat application-level Diet snapshots as a replacement for Supabase's project-level upgrade rollback behavior.

## Infrastructure operation

Use the Supabase Dashboard Infrastructure upgrade control.

P23 intentionally does not attempt to reproduce the managed-platform upgrade with SQL.

Do not manually ALTER extension versions as a substitute for the platform upgrade.

## Immediate post-upgrade checks

Run:

`private.platform_p23_post_upgrade_validation()`

The database portion must show:

- PostgreSQL 17.11 or newer;
- schema fingerprint equals the certified baseline;
- P23 preflight remains pass.

Then run:

- platform-health
- Auth health
- account platform smoke checks
- Notes sync checks
- Diet P18/P20/P21/P22
- TMS60 cloud sync/backup checks
- WTTN save read/write round trip
- Wordstrike profile/leaderboard checks
- Gomoku private-room presence checks
- Micro Arcade leaderboard checks
- Canvas load/edit/history checks

## Failure / rollback decision

If Supabase reports the upgrade itself failed, allow the managed platform to restore the original database as documented by Supabase.

If the upgrade succeeds but application validation fails:

1. keep affected applications in maintenance/read-only mode;
2. preserve logs and P23 post-upgrade output;
3. distinguish application incompatibility from data corruption;
4. do not rewrite data merely to make checks green;
5. use the relevant application recovery/runbook before reopening writes.

## Completion criteria

The upgrade is not complete merely because the Dashboard says PostgreSQL 17.11.

Completion requires:

- P23 post-upgrade validation = pass;
- shared schema SHA unchanged or deliberately recertified;
- platform-health healthy;
- all critical app smoke tests pass;
- Diet P18 clean;
- Diet P20 drift false;
- Diet P21 pass;
- Diet P22 pass;
- no new advisor finding requiring action.

Only then end the maintenance window.
