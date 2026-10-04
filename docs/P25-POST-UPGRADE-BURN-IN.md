# P25 — Post-Upgrade Burn-In, Stability & Shared-Platform Production Certification

P25 is currently **refreeze pending**.

The hosted Supabase upgrade remains historically validated, but no burn-in generation is currently eligible for certification. Generation 4 was invalidated by later shared-platform changes; generation 5 is the next candidate and has not yet activated. The historical generation sections below are retained as immutable operational history.

## Hosted-upgrade attestation

Historical upgrade evidence remains immutable:

- managed build: **17.6.1.127 → 17.6.1.164**
- release channel: **ga → preview**
- PostgreSQL server: **17.6** (`170006`)
- original post-upgrade semantic SHA: `c6a7b8788a3798e3fe119007e55f7d1b5796ece574a27dd10abeb600179a9918`
- semantic format: `platform-p23-shared-schema-v2`

PostgreSQL 17.11 remains a separate compatibility/security baseline and is not recorded as the running server version.

The legacy `private.platform_p24_post_upgrade_validation()` now reports a live schema/application-surface mismatch because shared applications evolved after the upgrade. Its current controls still report P18 clean, P20 drift false, P21 pass, P22 pass and cron healthy. The mismatch is expected application evolution, not evidence that the hosted upgrade failed.

## Earlier burn-in generations

Generation 1 was invalidated by legitimate shared-platform evolution after the hosted upgrade.

Generation 2 froze `20261002095255_gomoku_p16_certification_null_fix` at `2026-10-02T14:32:00.744993Z`, but was invalidated when Gomoku P17 introduced `gomoku_p17_release_environments_preview_promotion` and subsequent P17 health-isolation changes. Generation 2 is historical evidence only and cannot certify P25.

## Generation 3 active freeze

Generation 3 activated at:

**2026-10-02T20:16:15.888200Z**

Earliest possible certification:

**2026-10-03T20:16:15.888200Z**

Frozen identity:

- project: `ACTIVE_HEALTHY`
- migration: `20261002172133_gomoku_p17_certification_health_isolation`
- semantic SHA: `d5c977fc0d74ea6745ac588fc90656dadc18ee0568c3ac248cfd7540ceb6de00`
- `gomoku-room`: **v45**
- Edge SHA: `70e86288e735659c4f0a3c9a2608acf48305ae73afe915fefb22add8f293a2de`
- Edge deployment: `2026-10-02T17:21:44.278Z`
- cron: **11/11 active**
- cron executions in the activation 24h window: **4349 succeeded / 0 failed**
- blocking replication slots: **0**

At activation, the final shared epoch had been quiet for approximately **174 minutes**, exceeding the required 60-minute quiet period.

## Activation control evidence

Generation 3 was frozen only after the current control stack was revalidated:

- P18: **clean**
- P20 schema drift: **false**
- P21 readiness: **pass**
- P22 maintenance: **pass**
- all **11/11** Edge Functions active
- edge/function-edge traffic since the final P17 change: **0 HTTP 5xx**
- encrypted P15 off-site backup run **37040772134**: **success**
- backup created: **2026-10-02T17:26:57Z**, after both the final P17 migration and v45 Edge deployment

Security Advisor findings were reviewed, not auto-remediated:

- 64 RLS-enabled/no-policy relations; **0** have direct `anon` DML grants and **0** have direct `authenticated` DML grants
- 39 authenticated-callable public SECURITY DEFINER RPCs; **0** executable by `anon`, **39/39** reference `auth.uid()`, and **39/39** have controlled search paths
- leaked-password protection remains the known plan-level finding already tracked by the governance stack

Performance Advisor findings were also reviewed. P25 performs no speculative index creation/drop, VACUUM FULL, reindex, compute resize or pool tuning during burn-in.

## PostgreSQL 17.11 compatibility recheck

Application-owned schemas currently have:

- **0** `reg*` data-type columns relevant to the upgrade caveat
- **0** MD5 login roles
- **0** deprecated PG17 extensions
- **0** custom operators
- **0** risky ltree/btree_gist-style GiST indexes
- **0** replication slots

Supabase-managed Realtime internals contain their own `regclass`/`regrole` columns; those are managed platform objects rather than application-owned schema hazards.

## Performance baseline

| Metric | Pre-upgrade median | Pre-upgrade p95 | Warning threshold |
| --- | ---: | ---: | ---: |
| Auth | 371.5 ms | 710.8 ms | 1422 ms |
| Database | 561.5 ms | 1049.6 ms | 2100 ms |

Individual health checks fail at 4000 ms. A single warning does not fail P25; sustained or functional regression does.

## Generation 3 sampling

`.github/workflows/p25-post-upgrade-burnin.yml` remains the evidence collector.

Trigger opportunities:

- `17 * * * *`
- `7,27,37,47,57 * * * *`

The higher trigger opportunity density compensates for observed sparse GitHub scheduled-workflow delivery. Generation 3 began with 4 nominal opportunities/hour but produced only 5 successful samples in its first ~10 hours, so the schedule was increased to 6 nominal opportunities/hour without changing the probe or evidence rules. It does **not** change the evidence standard.

Generation 3 requires:

- at least **12** successful healthy public samples;
- samples spanning the full minimum 24-hour window;
- coverage of all **six 4-hour buckets** across the first 24 hours;
- a terminal successful sample at or after `2026-10-03T20:16:15.888200Z`;
- no migration/schema/Edge/relevant-cron epoch change during the window.

## Final certification requirements

At closure P25 must still verify:

- frozen generation-3 identity unchanged;
- project `ACTIVE_HEALTHY`;
- P18 clean;
- P20 drift false;
- P21 pass;
- P22 pass;
- zero unexplained cron failures;
- zero blocking replication slots;
- cross-app smoke matrix pass;
- required Edge inventory active;
- Auth, Realtime, PostgREST and Storage healthy;
- Security and Performance Advisors reviewed;
- PostgreSQL 17.11 application hazard scan clean;
- no sustained material latency regression.

## Completion

Generation 3 is **active but not yet certifiable**.

No P26 promotion may occur until the generation-3 minimum window, spanning sample requirements, frozen-epoch checks, and final control review all pass.


## P36 generation-4 refreeze — 2026-10-04

Generation 3 is retained as historical evidence but is no longer the active release epoch because the shared platform advanced after the Gomoku P17 freeze.

### Generation 4 active freeze

P25 generation 4 is **active but not yet certifiable**.

Frozen at `2026-10-04T12:55:17.146329Z`:

- migration: `20261003221217_hub_h15_tms60_projection`
- semantic schema SHA: `5b7b1caddef09b97f59c85d79d04eabfbe55120fe1754340a7367c1b14d39375`
- Gomoku Edge: v48 / `f0493fe400876a8d52f394724d6e44644978d2028b890c912ec283fdc32154cd`
- Edge Functions: 12
- cron jobs: 14
- P18: **clean**
- P20 schema drift: **false**
- P21 readiness: **pass**
- P22 maintenance: **pass**
- migration quiet at freeze: 883 minutes
- Edge quiet at freeze: 1536 minutes

Earliest certification is `2026-10-05T12:55:17.146329Z`.

Generation 4 still requires at least 12 healthy public samples spanning all six 4-hour buckets, a terminal sample at or after the 24-hour boundary, an unchanged release epoch, and a successful encrypted offsite backup captured after the final shared-platform change.

The previous generation-3 backup run `37040772134` remains historical evidence and is not treated as satisfying the new generation-4 post-final-change backup gate.

Generation 4 is **active but not yet certifiable**.


## P37 generation-4 invalidation and generation-5 candidate — 2026-10-04

Generation 4 is now **invalidated**. It cannot be certified.

After the P36 freeze, the shared platform changed again:

- migration advanced to `20261004132839_gomoku_p21_capacity_admission_gate`;
- `gomoku-room` advanced to **v49** / `64e5cfdd7a9d027e178eb4e8466b954504eb2bec1021bcb40c19afe8cd05b900`;
- `micro-arcade-p31-backup-export` advanced to **v2** / `84081a183835e6ea8c6791912a4e261b97d1e09c24c4fa6fdfc9a87f9e9460d2` at `2026-10-04T16:20:09.879000Z`.

The semantic schema fingerprint remains `5b7b1caddef09b97f59c85d79d04eabfbe55120fe1754340a7367c1b14d39375`, but migration and Edge identity are part of the frozen release epoch, so the generation-4 certificate is stale regardless of semantic-schema stability.

### Generation 5 is not active yet

Generation 5 is currently a **refreeze candidate**, not an active burn-in generation.

The 60-minute quiet clock starts after the latest observed shared release change at:

`2026-10-04T16:20:09.879000Z`

Earliest possible refreeze:

`2026-10-04T17:20:09.879000Z`

At the P37 observation the latest Edge change had been quiet for only about **1.56 minutes**, so the refreeze gate is open.

A new encrypted offsite backup after the final shared change is also required before generation 5 may activate under the existing strict refreeze policy.

### Sample identity

The P25 public probe now records:

- generation;
- generation state;
- current-generation eligibility;
- `qualifiesForBurnIn`.

While P25 is `refreeze_pending`, public health samples remain useful operational observations but **pre-refreeze samples do not qualify** for generation-5 certification.

Once generation 5 is legitimately activated, only samples carrying the matching active generation and `qualifiesForBurnIn: true` may satisfy its 24-hour / 12-sample / six-bucket / terminal-sample evidence requirements.


## P38 generation-5 refreeze progress — 2026-10-04

P38 rechecked the same generation-5 candidate at `2026-10-04T17:01:57.419724Z`.

The shared release epoch remained unchanged:

- migration: `20261004132839_gomoku_p21_capacity_admission_gate`
- semantic SHA: `5b7b1caddef09b97f59c85d79d04eabfbe55120fe1754340a7367c1b14d39375`
- Gomoku Edge: v49
- Micro Arcade backup Edge: v2
- Edge Functions: 12 / all active
- cron: 14/14 active
- cron failures: 0
- blocking replication slots: 0
- P18 clean / P20 drift false / P21 pass / P22 pass

At that observation the quiet window had reached **41.79 minutes out of the required 60 minutes**.

The earliest possible quiet-window completion remains:

`2026-10-04T17:20:09.879000Z`

The required post-final-change encrypted backup was still not verified, so generation 5 remained **blocked** and inactive.

P38 adds a reviewed preview-only activation mechanism and a generation-aware evidence ledger. Neither changes this current operational truth.
