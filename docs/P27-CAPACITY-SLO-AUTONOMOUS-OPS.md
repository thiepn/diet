# P27 — Capacity Planning, Long-Term SLOs & Autonomous Operations Hardening

P27 is **staged, not active**.

The dependency chain is intentional:

**P25 burn-in → P26 steady-state optimization → P27 long-term capacity/SLO operations**

P27 must not skip P26. Capacity forecasts and SLOs are only credible after the post-upgrade platform has a real steady-state baseline.

## Purpose

P27 turns short-term health checks into long-lived operational policy:

- capacity forecasting;
- service-level objectives and error budgets;
- saturation and growth thresholds;
- alert deduplication and burn-rate handling;
- safe autonomous detection/reporting;
- explicit boundaries on what automation may never change by itself.

The objective is not to make production “self-modifying.” The objective is to make production **self-observing, self-classifying, and operationally predictable**.

## Current capacity snapshot

The current values are provisional because P26 has not yet produced its authoritative steady-state baseline.

| Signal | Current observation |
| --- | ---: |
| Database size | 26 MB |
| PostgreSQL max connections | 60 |
| Reserved connections | 3 |
| Usable connections | 57 |
| Current connections | 10 / 57 (17.54%) |
| Active connections | 1 / 57 (1.75%) |
| Idle connections | 8 |
| Idle in transaction | 0 |
| Sessions >30s | 0 |
| Blocked sessions | 0 |
| Largest relation | 983,040 bytes |
| User table bytes | 6,660,096 |
| User index bytes | 5,758,976 |
| WAL bytes since stats reset | 16,619,422 |

There is no current evidence that compute, connection limits, disk, or read scaling need to change.

Supabase's current connection-management guidance emphasizes sizing pool allocations from **observed peak usage**, while Reports expose connection, CPU, memory, disk IOPS, disk usage and database-size trends. P27 follows that evidence-first approach.

## Traffic snapshot

Since the hosted upgrade:

- observed high-volume hour: 1,162 gateway requests;
- observed 5xx: 0;
- p95 origin latency during that hour: approximately 449 ms.

Low-volume hours are not used to calibrate long-term percentile SLOs because a handful of requests can distort p95.

## Capacity policy

P27 stages these operating thresholds:

### Connections

- warning: sustained usage above **60% of usable connections** for 15 minutes;
- critical: sustained usage above **80%** for 15 minutes;
- any persistent idle-in-transaction connection is diagnostic;
- any blocked session is diagnostic;
- long-running active/idle-in-transaction sessions above 30 seconds are investigated before cancellation is considered.

These are operational thresholds, not automatic resize triggers.

### Storage and growth

A capacity forecast requires at least **14 days** of daily snapshots.

P27 will project:

- 30 days;
- 90 days;
- 180 days;
- 365 days.

No disk percentage threshold is invented until the actual provisioned disk limit is known from Supabase's platform data. Forecasts should produce **days-to-threshold**, not just current percentage.

### Compute and pooling

No compute resize, pool-size change, IOPS purchase, or read replica should be recommended from a single spike.

A capacity action requires sustained evidence identifying the bottleneck: CPU, memory, I/O, connections, read load, geographic latency, or storage growth.

Read Replicas are considered only for measured read pressure or geographic latency requirements. They are not a generic reliability toggle: Supabase documents that replica reads are asynchronous and products such as Auth still route to the primary.

## Candidate SLO model

These SLOs remain **provisional until P26 finishes**.

### Availability

Candidate monthly target:

**99.9%**

Approximate monthly error budget:

**43.2 minutes**

Availability is not inferred from one percentage alone. P27 combines:

- public synthetic success;
- gateway 5xx;
- Auth health;
- platform-health;
- request volume.

Low traffic requires synthetic evidence because one failed request can otherwise produce a misleadingly large percentage.

### Latency

Absolute p95 thresholds are derived from the authoritative P26 baseline.

Candidate formulas:

- REST warning: `max(1.5 × P26 REST p95, 750 ms)`
- REST critical: `max(2.0 × P26 REST p95, 1500 ms)`
- Auth warning: `max(1.5 × P26 Auth p95, 750 ms)`
- Auth critical: `max(2.0 × P26 Auth p95, 1500 ms)`

A latency alert requires at least **3 consecutive breaches** unless there is a functional outage.

### Database

Long-term desired invariants:

- deadlocks: 0;
- persistent blockers: 0;
- idle-in-transaction accumulation: 0;
- repeated query mean >100 ms only becomes actionable at meaningful call volume (>=10 calls in the observation window).

## Error-budget policy

P27 distinguishes:

- **fast burn**: approximately one-hour window;
- **slow burn**: approximately six-hour window.

A single warning does not page or trigger remediation.

The sequence is:

1. observe;
2. correlate;
3. classify;
4. attach an evidence anchor;
5. recommend the appropriate runbook;
6. require human approval for production mutation.

## Autonomous operations model

### L0 — collect only

Read metrics and preserve evidence.

### L1 — detect, classify, report

This is the default P27 autonomy level.

Allowed without approval:

- read-only metrics;
- synthetic probes;
- SLO/error-budget calculations;
- advisor classification;
- duplicate-alert suppression;
- evidence artifacts;
- runbook recommendation.

### L2 — pre-authorized reversible actions

**Not active.**

An action may become L2 only after it has:

- an explicit runbook;
- bounded blast radius;
- proven reversibility;
- dry-run/simulation coverage;
- automatic verification;
- an automatic rollback condition;
- no user-data mutation;
- registration under P20 change governance.

### L3 — human approval

Production mutation remains here by default.

Automation must not independently:

- execute schema DDL;
- add/drop indexes;
- run `VACUUM FULL`;
- run `REINDEX`;
- terminate sessions;
- resize compute;
- change pool limits;
- change disk/IOPS;
- add/remove replicas;
- change Auth limits;
- modify RLS;
- rotate credentials;
- pause/restore a project;
- delete user data.

## Alert quality

Every actionable alert must include a concrete evidence anchor such as:

- path;
- HTTP status;
- request ID;
- query ID;
- relation;
- PID;
- advisor lint;
- workflow run.

Alerts deduplicate by **signal + surface + severity**, have a default 60-minute cooldown, and suppress isolated transient warnings.

## P27 activation

P27 becomes active only after P26 is formally certified.

Until then:

- active operations release remains P25.0;
- P26 remains the next operational dependency;
- P27 workflows stay manual-only;
- no P27 production mutation occurs.
