# P24 — Manual Upgrade Handoff — READY

The automated preparation has reached the hosted Supabase infrastructure boundary.

## Final verified state

- live execution gate: `ready_for_manual_upgrade`
- PostgreSQL: 17.6
- target: 17.11
- certified shared SHA: `8239b32928be652214a63ae733d42bace71d46d7145e3e6e5eea8b7f066e1dfe`
- latest shared migration: `20260930164232_gomoku_p7_ranked_active_opponent_index`
- database quiet time at final gate: 225.23 minutes
- latest `gomoku-room`: v27, SHA `958f85954b7b0e1fe01d67eafc01e6e25e9c216743a6c46ba0e695d218db5068`
- Edge quiet time at capture: about 185.63 minutes
- P23 preflight: pass
- blocking replication slots: 0
- six registered Account apps
- eight cron jobs active, recent failures 0
- fresh Diet recovery snapshot: 2026-09-30 20:27:39 UTC, verified
- latest encrypted P15 off-site backup: run `36744693032`, success
- connector can execute hosted upgrade: **no**

## One remaining infrastructure action

Immediately before clicking Upgrade project, re-run the live P24 gate and re-list Edge Functions. Proceed only if the gate still returns:

```text
status = ready_for_manual_upgrade
readyForManualUpgrade = true
schemaMatchesCertification = true
preflightStatus = pass
writesPaused = false
quietMinutes >= 10
```

The Supabase Dashboard eligibility check must also be clean.

Then enable the Diet P21 write freeze:

```sql
select private.diet_p21_set_write_freeze(
  true,
  'P24 PostgreSQL 17.11 managed upgrade'
);
```

Immediately perform:

**Supabase Dashboard → THIEPN Account → Upgrade project → PostgreSQL 17.11**

Do not enable the write freeze until the Dashboard upgrade is about to begin.

## After Supabase reports completion

Keep writes frozen and run the post-upgrade certification. Require:

- PostgreSQL 17.11+
- P23 post-upgrade validation = pass
- exact shared-schema fingerprint match
- platform-health = healthy
- P18 = clean
- P20 = no Diet drift
- P21 = pass
- P22 = pass
- Auth, Realtime, cron and Edge Functions healthy
- critical cross-app smoke matrix pass

Only then remove the write freeze and activate P25's >=24-hour production burn-in.
