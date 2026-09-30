# P25 — Post-Upgrade Burn-In, Stability & Shared-Platform Production Certification

P25 is **staged but not active**. It must not be used to claim completion until the managed PostgreSQL 17.11 upgrade from P24 has actually completed.

## Current production gate

Live checks on 2026-09-30 show:

- project: `THIEPN Account` (`hycegznamzjhwinegaai`)
- PostgreSQL: **17.6** (`170006`)
- target: **17.11**
- P24 execution gate: **blocked**
- current shared schema SHA: `ab518103bacfcadd476db7e95255fd3fda6135b5285ea13d187805cdce7356ce`
- last certified SHA: `f5485033a2845f9a1baacee6811c976c72e5ffb5d73bf0b9a50e3d0c0b48647c`
- latest migration: `20260930132757_gomoku_p6_online_player_identity_profiles`
- latest observed `gomoku-room` Edge Function: **v23**; the P24 handoff recorded v21
- P23 preflight currently fails because two active **temporary Supabase Realtime replication slots** are present

Therefore the previous P24 handoff is stale. P24 must be refreshed immediately before the Dashboard upgrade. P25 cannot start before that.

## Why P25 needs a real burn-in window

A version check immediately after `pg_upgrade` only proves that the database restarted. It does not prove that normal traffic, scheduled jobs, backups, Edge Functions, Auth, Realtime, or application workflows remain stable.

P25 therefore requires a **minimum 24-hour burn-in** after the upgrade and after the maintenance window closes. This is long enough to observe at least one daily recovery/backup cycle and normal application load.

## Pre-upgrade reliability baseline

The 24-hour pre-upgrade `platform-health` sample set contained 12 healthy observations.

| Metric | Median | p95 | Max |
| --- | ---: | ---: | ---: |
| Auth latency | 371.5 ms | 710.8 ms | 757 ms |
| Database latency | 561.5 ms | 1049.6 ms | 1153 ms |

P25 uses **2× pre-upgrade p95** as a performance-regression warning boundary:

- Auth p95 warning: **1422 ms**
- Database p95 warning: **2100 ms**
- Individual health check timeout/failure boundary: **4000 ms**

A warning is not automatically a release failure; repeated degradation, timeouts, or functional errors are.

## Activation gate

P25 activates only after all of the following are true:

1. Supabase reports PostgreSQL **17.11 or newer**.
2. P23 post-upgrade validation reports **pass**.
3. The shared schema fingerprint has been refreshed against the final pre-upgrade state.
4. Cross-app post-upgrade smoke tests pass.
5. The temporary P21 write freeze is removed and normal production traffic resumes.

## Burn-in checks

During the burn-in window collect at least 12 public health samples spanning at least 24 hours. The scheduled P25 workflow records:

- Diet production shell reachability;
- Supabase Auth health;
- `platform-health` status;
- Auth and database latency;
- browser denial of service-only P23/P24 operator RPCs.

The final P25 certification also requires live privileged checks:

- PostgreSQL remains 17.11+;
- shared schema fingerprint remains unchanged from the accepted post-upgrade baseline;
- P18 integrity = clean;
- P20 schema drift = false;
- P21 failure/readiness = pass;
- P22 maintenance = pass;
- all expected pg_cron jobs active;
- zero new unexplained cron failures after the upgrade;
- no persistent replication-slot residue that blocks maintenance;
- all required Edge Functions ACTIVE with version/hash changes explained;
- no material increase in Auth/database/Edge/PostgREST error rates;
- no new upgrade-related security or performance advisor finding;
- the first P15 encrypted off-site backup **after the upgrade** succeeds.

## Cross-app matrix

P25 inherits the P23/P24 matrix and must smoke-test:

- THIEPN Account
- Diet Copilot
- Notes
- TMS60
- WTTN
- Wordstrike
- Gomoku
- Leaderboard
- Micro Arcade
- Canvas
- Auth
- Edge Functions
- Realtime
- cron

## PostgreSQL 17.11 regression review

Supabase's 17.11 rollout identifies four areas requiring explicit re-checks:

- `ltree` indexes;
- legacy `pgcrypto` PGP cipher usage;
- `btree_gist` float/NaN indexes;
- custom operators using non-built-in selectivity estimators.

The earlier P23 scan found none, but P25 reruns the detection after upgrade because the shared schema changed after the P24 handoff.

## Completion criteria

P25 may be marked complete only when:

- burn-in duration >= 24 hours;
- required public samples span the window;
- no unresolved outage/degradation exists;
- p95 performance does not show a sustained material regression;
- first post-upgrade off-site backup succeeds;
- cron and long-running operational controls remain healthy;
- cross-app smoke matrix passes;
- advisors and PostgreSQL 17.11 hazard re-checks are acceptable;
- migration closure evidence records the final PostgreSQL version, schema SHA, Edge inventory, backup run, and burn-in window.

Until then, the migration remains **open**.
