# P24 — Manual Upgrade Handoff — READY

The automated work has reached the managed-infrastructure boundary.

## Current ready state

At the refreshed handoff:

- execution gate: `ready_for_manual_upgrade`
- PostgreSQL: 17.6
- target: 17.11
- shared schema SHA: exact certified match
- database quiet window: satisfied
- latest observed shared Edge deployment: `gomoku-room` v21 at 01:51 UTC
- Edge quiet window: satisfied
- fresh recovery snapshot: 12:51 UTC, verified
- latest encrypted off-site backup on current P24 head: success

## Before clicking Upgrade project

Run the service-only P24 execution gate. Proceed only if it returns:

```text
status = ready_for_manual_upgrade
readyForManualUpgrade = true
schemaMatchesCertification = true
preflightStatus = pass
writesPaused = false
quietMinutes >= 10
```

If it reports `blocked`, do not override it. A new migration may have landed.

Re-list the project's Edge Functions one final time. Require at least **10 minutes with no shared Edge Function deployment** and no unexplained version/hash difference from the refreshed v21 inventory. The SQL execution gate cannot observe Edge deployments.

## Dashboard action

**Supabase Dashboard → THIEPN Account → Project Settings → Infrastructure → Upgrade project**

Choose the managed in-place upgrade to PostgreSQL **17.11**.

## Immediately before starting

Enable Diet's P21 write freeze:

```sql
select private.diet_p21_set_write_freeze(
  true,
  'P24 PostgreSQL 17.11 managed upgrade'
);
```

Do this immediately before the actual Dashboard upgrade, not hours beforehand.

## After Supabase reports completion

Do not unfreeze yet.

Run the P23 post-upgrade validator and cross-app checks. The database version alone is not sufficient.

Only disable the freeze after:

- P23 post-upgrade validation = pass;
- shared schema fingerprint matches;
- platform-health = healthy;
- P18 = clean;
- P20 = no Diet drift;
- P21 = pass;
- P22 = pass;
- critical app smoke tests pass.
