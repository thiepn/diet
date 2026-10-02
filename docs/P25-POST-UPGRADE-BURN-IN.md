# P25 — Post-Upgrade Burn-In, Stability & Shared-Platform Production Certification

P25 is **active**.

The hosted Supabase upgrade remains historically validated. The current certifiable burn-in is **generation 3**, frozen on the final Gomoku P17 health-isolation epoch after the required quiet window and a successful encrypted backup after the final shared change.

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

Generation 2 froze the P16 epoch at `2026-10-02T14:32:00.744993Z`, but was invalidated when Gomoku P17 changed the database and Edge release epoch. Generation 2 is historical evidence only and cannot certify P25.

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
- `7,27,47 * * * *`

The higher trigger opportunity density compensates for previously observed sparse GitHub scheduled-workflow delivery. It does **not** change the evidence standard.

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
