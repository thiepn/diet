# P26 — Post-Migration Steady-State Baseline, Performance & Operational Optimization

P26 is **staged, not active**. P25 remains the active operations phase until its burn-in is formally certified.

## Purpose

P26 converts the post-upgrade system from “healthy after migration” into a measured steady-state platform. It establishes durable baselines, defines regression guardrails, and only then applies optimizations that have evidence, a measurable target, and a rollback path.

P26 deliberately avoids “cleaning up” every advisor finding. After a PostgreSQL restart, statistics are young and many indexes appear unused simply because the observation window is short.

## Activation gate

P26 may activate only after:

- P25 is certified complete;
- at least 24 hours of P25 burn-in have elapsed;
- at least 12 successful P25 samples span that window;
- the first post-upgrade encrypted P15 backup succeeded;
- P24 remains pass;
- P18 is clean;
- P20 drift is false;
- P21 readiness is pass;
- P22 maintenance is pass;
- the final baseline capture occurs after at least 60 minutes without a shared database migration or Edge deployment.

The repository must remain at operations release **P25.0** until this gate is satisfied.

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

The current Performance Advisor reports two unindexed foreign keys:

- `public.micro_arcade_best_scores(player_id)`
- `public.micro_arcade_lb_reviews(run_id)`

These are candidates, not automatic changes. Both are currently small surfaces; P26 will measure join/delete/update behavior before deciding whether covering indexes improve real workload.

The advisor also reports 71 unused indexes. **No unused index may be dropped from this evidence.** PostgreSQL usage statistics reset during the hosted upgrade, and none of the currently zero-scan indexes is at least 1 MiB. Index-removal analysis requires at least seven days of post-reset observations and explicit review of uniqueness, constraints, authorization paths, cron paths, and rare operational queries.

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
