# P27 — Capacity Planning, Long-Term SLOs & Autonomous Operations Hardening

P27 engineering implementation is **active by explicit operator override**. The remaining P25/P26 time-based certification gates no longer block development progression. That override does **not** authorize autonomous production mutation.

## Purpose

P27 converts point-in-time health evidence into long-lived operating policy for capacity, service objectives, error budgets, alert quality and bounded automation.

The target is **self-observing and self-classifying infrastructure**, not self-modifying infrastructure.

## Current live capacity snapshot

Read-only production observation at **2026-10-03 08:44 UTC**:

| Signal | Observation |
| --- | ---: |
| Database size | 35 MB |
| PostgreSQL max connections | 60 |
| Reserved connections | 3 |
| Usable connections | 57 |
| Current connections | 10 / 57 (17.54%) |
| Active connections | 1 / 57 (1.75%) |
| Idle connections | 8 |
| Idle in transaction | 0 |
| Sessions >30 s | 0 |
| Blocked sessions | 0 |
| Largest relation | 1,400,832 bytes |
| User-table bytes | 11,722,752 |
| User-index bytes | 8,527,872 |
| WAL bytes since stats reset | 56,014,422 |

There is no evidence supporting a compute, pool, disk/IOPS or replica change.

The previous P27 staging snapshot measured 26,799,251 bytes on 2026-10-01. The database is now 36,596,883 bytes, roughly 5.37 MB/day over this short interval. **That is not a qualified forecast**: the window is only 1.823 days and includes active shared-platform development.

## Current traffic capacity

The highest observed gateway hour in the current log window is **2026-10-03 08:00 UTC**:

- 10,289 requests;
- 0 HTTP 5xx;
- p95 origin latency 187 ms.

Other high-volume hours reached 6,729, 5,893 and 4,380 requests with zero 5xx. Low-volume hours are excluded from long-term percentile calibration because a handful of requests can make p95 misleading.

## Capacity policy

Connection utilization uses usable capacity: `max_connections - superuser_reserved_connections = 57`.

- warning: sustained >60% for 15 minutes;
- critical: sustained >80% for 15 minutes;
- any persistent idle-in-transaction session is diagnostic;
- any blocked session is diagnostic;
- sessions >30 seconds are investigated before cancellation is even considered.

A database-growth forecast is **qualified only with at least 14 days and at least 3 snapshots**. The forecast engine still emits provisional projections earlier, but marks them unqualified.

Forecast horizons are 30, 90, 180 and 365 days. If a real provisioned capacity limit is supplied, the engine also calculates days-to-capacity. It never invents a disk limit.

Compute, pool, IOPS and replica actions require sustained, attributed pressure. A single spike never authorizes a capacity mutation.

## Active candidate SLO policy

### Availability

Target: **99.9% over 30 days**.

Approximate 30-day error budget: **43.2 minutes**.

P27 tracks both request failures and synthetic health. Low traffic cannot hide behind percentages: a failed synthetic health path remains an operational failure signal even when request volume is small.

### Latency

P26's current measured baselines are used as the seed:

- REST p95 baseline: 326 ms;
- Auth gateway p95 baseline: 619 ms.

Derived candidate thresholds:

| Surface | Warning | Critical |
| --- | ---: | ---: |
| REST p95 | 750 ms | 1500 ms |
| Auth p95 | 929 ms | 1500 ms |

Latency warning requires three consecutive breaches unless functionality is failing.

### Error-budget burn

P27 now evaluates explicit burn rates:

- fast window: 1 hour;
- fast critical burn: 14.4× budget;
- slow window: 6 hours;
- slow critical burn: 6× budget.

An isolated warning does not authorize remediation.

## Autonomous operations

### L0 — collect

Metrics and evidence only.

### L1 — detect, classify, report

**Active default.**

Allowed without approval:

- read-only metrics;
- synthetic probes;
- capacity forecasts;
- SLO/error-budget calculations;
- alert deduplication;
- evidence artifacts;
- runbook recommendation.

### L2 — pre-authorized reversible action

Not active. Eligibility requires an explicit runbook, bounded blast radius, proven reversibility, simulation coverage, automatic verification and rollback, no user-data mutation, and P20 registration.

### L3 — human-approved production mutation

All production mutation remains here.

P27 automation cannot independently perform DDL, add/drop indexes, run VACUUM FULL or REINDEX, terminate sessions, resize compute, change pool size, alter disk/IOPS, add/remove replicas, change Auth limits or RLS, rotate secrets, pause/restore the project, or delete user data.

## Alert quality

Every actionable alert must carry an evidence anchor: request/path/status, query ID, relation, PID, advisor lint or workflow run.

Alerts deduplicate by **signal + surface + severity**, use a 60-minute cooldown and suppress isolated transient warnings.

## Scheduled evidence

The P27 public synthetic workflow runs hourly. It is read-only and produces evidence artifacts only. Scheduled monitoring is allowed under the operator override because it does not mutate production.

## Completion

P27 is complete as an engineering phase when:

- capacity forecasting is qualified over >=14 days / >=3 snapshots;
- 30/90/180/365-day projections are generated;
- healthy, slow-burn and fast-burn SLO paths are contract-tested;
- hourly synthetic evidence is active;
- the autonomy engine proves production mutation is disabled without approval;
- no destructive autonomous path exists.
