# P24 — Manual Upgrade Handoff — LIVE GATE REQUIRED

The automated preparation is complete up to the managed-infrastructure boundary, but the shared platform is actively developed. A static “READY” label is therefore insufficient.

## Recorded refreshed state

- PostgreSQL: 17.6
- target: 17.11
- current certified shared SHA: `b2d94e5bfa4cfb06c346a5486ebaa918a86c83737e65879691b241e66c17573f`
- latest recorded shared migration: `20260930162517_gomoku_p7_ranked_read_models`
- latest recorded `gomoku-room`: v24 at 2026-09-30 15:06:14 UTC
- blocking replication slots at latest refresh: 0
- fresh Diet recovery snapshot: 2026-09-30 16:19:59 UTC, verified
- connector can execute managed upgrade: no

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

If it reports `blocked`, do not override it. The most likely causes are a newer shared migration, a changed schema fingerprint, a new blocking replication slot, or the final quiet window not yet being satisfied.

Then re-list Edge Functions. Require at least **10 minutes without an unexplained shared Edge Function deployment**.

The Supabase Dashboard's own eligibility check is authoritative and must also be clean.

## Dashboard action

**Supabase Dashboard → THIEPN Account → Project Settings/General Settings → Upgrade project**

Use the managed upgrade to PostgreSQL **17.11**.

## Immediately before starting

Enable Diet's P21 write freeze:

```sql
select private.diet_p21_set_write_freeze(
  true,
  'P24 PostgreSQL 17.11 managed upgrade'
);
```

Do this only immediately before the actual hosted upgrade.

## After Supabase reports completion

Do not unfreeze yet. Require:

- P23 post-upgrade validation = pass;
- PostgreSQL 17.11+;
- shared schema fingerprint match;
- platform-health = healthy;
- P18 = clean;
- P20 = no Diet drift;
- P21 = pass;
- P22 = pass;
- Auth/Realtime/cron/Edge Functions healthy;
- critical cross-app smoke tests pass.

Only then remove the write freeze and start P25's production burn-in.
