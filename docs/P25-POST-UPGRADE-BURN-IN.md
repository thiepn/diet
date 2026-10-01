# P25 — Post-Upgrade Burn-In, Stability & Shared-Platform Production Certification

P25 is **active**.

The hosted Supabase upgrade completed and P24 post-upgrade validation passed at **2026-10-01 12:14:50 UTC**. The minimum 24-hour burn-in therefore cannot complete before **2026-10-02 12:14:50 UTC**.

## What actually upgraded

The managed Dashboard operation moved the project from Supabase database build **17.6.1.127** to **17.6.1.164** and changed the reported release channel from **ga** to **preview**. PostgreSQL itself still reports **17.6** (`170006`).

This is treated as the completed **hosted Supabase build upgrade**. PostgreSQL **17.11** remains a separate compatibility/security baseline and is **not** falsely recorded as the server version.

Supabase's current upgrade documentation describes "Upgrade project" as moving a project to a new Supabase instance and running `pg_upgrade`; the actual hosted target is whatever build Supabase offers for that project.

## P24 validation result

The authoritative post-upgrade validator is now:

`private.platform_p24_post_upgrade_validation()`

It currently reports **pass**.

Validated evidence:

- project status: ACTIVE_HEALTHY
- hosted build: 17.6.1.127 → 17.6.1.164
- database restart: 2026-10-01 07:54:44 UTC
- semantic schema fingerprint: `c6a7b8788a3798e3fe119007e55f7d1b5796ece574a27dd10abeb600179a9918`
- fingerprint format: `platform-p23-shared-schema-v2`
- application surface counts match pre-upgrade
- P18 integrity: clean
- P20 schema drift: false
- P21 readiness: pass
- P22 maintenance: pass
- cron: 8/8 active, zero failures in the post-upgrade check
- blocking replication slots: zero
- Auth requests succeeded after restart
- Realtime health returned HTTP 200 after restart
- PostgREST traffic succeeded after restart
- Storage traffic exists after restart
- all Edge Functions are ACTIVE
- read-only smoke checks passed across Account, Diet, Notes, TMS60, WTTN, Wordstrike, Gomoku, Leaderboard, Micro Arcade and Canvas

## Fingerprint repair

The old P23 fingerprint serialized RLS policy role arrays as raw PostgreSQL role OIDs. A hosted instance rebuild can legitimately assign new OIDs even when policy semantics are unchanged, producing false schema drift.

P25/P24 now use `platform-p23-shared-schema-v2`, which hashes **role names instead of internal OIDs**.

## Burn-in window

Start: **2026-10-01T12:14:50.879365Z**

Earliest completion: **2026-10-02T12:14:50.879365Z**

Requirements:

- at least 24 hours elapsed;
- at least 12 successful hourly public samples spanning the window;
- first post-upgrade encrypted P15 off-site backup succeeds;
- no unresolved functional outage;
- no sustained material latency regression;
- no new unexplained cron failures;
- P18 remains clean;
- P20 remains drift-free;
- P21 remains pass;
- P22 remains pass;
- Auth, Realtime, PostgREST, Storage and required Edge Functions remain healthy;
- cross-app smoke matrix remains good;
- advisors are reviewed again at closure;
- PostgreSQL 17.11 hazard checks remain clean even though the hosted server is still 17.6.

## Performance baseline

| Metric | Pre-upgrade median | Pre-upgrade p95 | Warning threshold |
| --- | ---: | ---: | ---: |
| Auth | 371.5 ms | 710.8 ms | 1422 ms |
| Database | 561.5 ms | 1049.6 ms | 2100 ms |

Individual health checks fail at 4000 ms. A single warning does not fail P25; sustained or functional regression does.

## Hourly evidence

`.github/workflows/p25-post-upgrade-burnin.yml` runs hourly on `main` and records:

- Diet production shell reachability;
- Auth health;
- `platform-health`;
- Auth/database latency;
- denial of service-only P23/P24 operator RPCs.

Artifacts are retained for 30 days.

## Completion

P25 is **not complete yet**. It will close only after the full minimum window and all final checks pass.
