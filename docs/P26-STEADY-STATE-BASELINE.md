# P26 — Post-Migration Steady-State Baseline, Performance & Operational Optimization

P26 is **staged, not active**. P25 remains the active operations phase until its burn-in is formally certified.

## Purpose

P26 converts the post-upgrade system from “healthy after migration” into a measured steady-state platform. It establishes durable baselines, defines regression guardrails, and only then applies optimizations that have evidence, a measurable target, and a rollback path.

P26 deliberately avoids “cleaning up” every advisor finding. After a PostgreSQL restart, statistics are young and many indexes appear unused simply because the observation window is short.

## Activation gate

P26 may activate only after:

- P25 generation 3 is formally certified complete;
- at least 24 hours of generation-3 burn-in have elapsed;
- at least 12 successful healthy samples span the full window, cover all six 4-hour buckets, and include a terminal sample after the minimum completion time;
- the frozen migration/schema/Edge/relevant-cron epoch remains unchanged;
- the historical hosted-upgrade attestation remains pass;
- the encrypted P15 backup taken after the final shared database/Edge change remains successful;
- P18 is clean;
- P20 drift is false;
- P21 readiness is pass;
- P22 maintenance is pass;
- Security and Performance Advisor closure review is complete;
- the final baseline capture occurs after at least 60 minutes without a shared database migration or Edge deployment.

Generation 3 activated at **2026-10-02 20:16:15 UTC**. Its earliest possible certification is **2026-10-03 20:16:15 UTC**. The repository must remain at operations release **P25.0** until the full gate is satisfied. The legacy live P24 validator is not used as a current-schema gate because legitimate shared-application evolution occurred after the hosted upgrade; the immutable historical hosted-upgrade attestation is the correct prerequisite.

## Provisional post-upgrade baseline

Statistics reset with the hosted upgrade at approximately 2026-10-01 07:53 UTC. The following values are therefore **provisional**.

| Signal | Provisional value | Interpretation |
| --- | ---: | --- |
| Overall DB cache hit | 99.6894% | Healthy |
| Table block hit | 94.1227% | Warm-up; not yet a steady-state target |
| Index block hit | 90.7737% | Warm-up; not yet a steady-state target |
| Active DB connections | 1 | Low pressure |
| Idle DB connections | 7 | Normal current footprint |
| Waiting locks | 0 | Healthy |
| Deadlocks | 0 | Healthy |
| Conflicts | 0 | Healthy |
| pg_stat_statements calls | 9,548 | Early observation set |
| Weighted mean execution | 2.754 ms | Includes platform/admin work |
| Repeated statements >100 ms mean with >=10 calls | 0 | No repeated slow-query signal yet |

Application-facing role means:

| Role | Calls | Weighted mean execution |
| --- | ---: | ---: |
| authenticator | 197 | 29.036 ms |
| authenticated | 86 | 7.302 ms |
| service_role | 2,050 | 0.341 ms |
| anon | 40 | 0.254 ms |

Operator/admin traffic is measured separately and must not be used to claim application regressions.

## Live provisional refresh — 2026-10-03 08:09 UTC

A second read-only capture shows the database continuing to warm and improve while P25 remains active:

| Signal | Refreshed value | Interpretation |
| --- | ---: | --- |
| Overall DB cache hit | 99.9657% | Healthy |
| Table block hit | 99.7695% | Healthy |
| Index block hit | 99.6943% | Healthy |
| Active / idle / other connections | 1 / 10 / 1 | Low pressure |
| Waiting locks | 0 | Healthy |
| Deadlocks / conflicts | 0 / 0 | Healthy |
| pg_stat_statements calls | 160,516 | Much larger observation set |
| Weighted mean execution | 1.199 ms | Improved from the first provisional capture |
| Repeated statements >100 ms mean with >=10 calls | 1 | Classified below |

Application-facing role means at this refresh were: authenticator **16.290 ms** over 2,322 calls, authenticated **5.753 ms** over 181 calls, service_role **0.265 ms** over 103,855 calls, and anon **0.122 ms** over 309 calls.

The one repeated slow statement is `SELECT name FROM pg_timezone_names`: 45 calls, 672.400 ms mean, 1,231.413 ms max. No reference to `pg_timezone_names` exists in the Diet Copilot repository, so P26 classifies it as platform/introspection traffic unless later evidence correlates it with a user-facing workflow. It is not grounds for application-schema DDL.

Temporary I/O has grown to about **11.15 GB** since the statistics reset. The largest currently visible temp-block consumers are operator/baseline queries, so P26 still does not infer application memory pressure from the aggregate counter. No `work_mem`, compute, or pool tuning is justified from this signal alone.

## Service baseline

Structured Edge logs since the restart show:

| Surface | Requests | 5xx | p50 origin | p95 origin | max |
| --- | ---: | ---: | ---: | ---: | ---: |
| Auth routes | 38 | 0 | 162 ms | 541 ms | 911 ms |
| REST routes | 1,022 | 0 | 151 ms | 450 ms | 1,639 ms |
| Other routed traffic | 107 | 0 | 24 ms | 312 ms | 848 ms |

Auth service request-completion logs show p50 **7.993 ms**, p95 **287.445 ms**, max **307.043 ms**, with zero 5xx in the captured window.

PostgREST emitted 19 timeout-manager messages, but no corresponding user-facing Edge 5xx were observed. P26 treats this as a watch signal: investigate only if it correlates with failed requests, elevated p95, or a reproducible user workflow failure.

## Advisor findings

The 2026-10-03 Performance Advisor snapshot reports **21 unindexed foreign keys**: 19 on newer Gomoku shared-platform tables and the two earlier Micro Arcade findings:

- `public.micro_arcade_best_scores(player_id)`
- `public.micro_arcade_lb_reviews(run_id)`

These are candidates, not automatic changes. The largest currently observed candidate table is only 147,456 bytes. `micro_arcade_best_scores` has 8 live rows and 49,152 total bytes; `micro_arcade_lb_reviews` has 5 live rows and 32,768 total bytes. P26 will measure actual delete/update/join behavior before deciding whether covering indexes improve a real workload.

The advisor now reports **108 unused indexes** as the shared platform has expanded. PostgreSQL statistics show 467 user indexes total, 342 with zero scans, but **zero** zero-scan indexes are at least 1 MiB. **No unused index may be dropped from this evidence.** Statistics reset during the hosted upgrade and the shared-platform schema has continued to evolve. Index-removal analysis still requires at least seven days of post-reset observations plus explicit review of uniqueness, constraints, authorization paths, cron paths, and rare operational queries.

## Temp I/O

The database has recorded substantial temporary bytes since restart, but P26 does not assume this is application pressure. The same window includes heavy operator/Supabase-admin queries used for upgrade certification. P26 must attribute temp I/O by workload before tuning `work_mem`, query shape, or compute.

## Optimization rules

P26 uses these rules:

1. No database DDL while P25 is still burning in.
2. Never reset `pg_stat_statements` during the authoritative measurement window.
3. Capture at least 72 hours for the authoritative steady-state baseline.
4. Observe unused indexes for at least seven days before considering removal.
5. Change one optimization class at a time.
6. Require before/after measurements for every accepted optimization.
7. Roll back any optimization that causes functional, security, integrity, or sustained latency regression.
8. Do not use `VACUUM FULL`, `REINDEX`, connection-pool changes, or compute upgrades as generic cleanup.
9. Preserve all P14–P25 security, recovery, integrity, concurrency and governance controls.

## Steady-state guardrails

The final thresholds are derived from the authoritative P26 baseline rather than invented now. The policy will use both absolute functional failures and relative regressions:

- any sustained user-facing 5xx increase is actionable;
- repeated public health failures are actionable;
- p95 latency warnings use a baseline multiplier and require multiple consecutive samples;
- DB deadlocks or waiting-lock persistence are actionable;
- repeated slow statements must have meaningful call volume before optimization;
- capacity changes require sustained connection, CPU, memory, disk or I/O pressure rather than a single spike.

## Planned outputs

P26 will produce:

- an authoritative steady-state baseline after P25;
- public service latency/error baselines;
- application-role query baselines;
- workload-qualified advisor review;
- a measured optimization backlog;
- before/after evidence for accepted changes;
- a final operations policy suitable for long-term monitoring.

Until P25 closes, P26 remains **staged_pending_p25** and performs no production DDL.
