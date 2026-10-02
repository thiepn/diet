# P25 — Post-Upgrade Burn-In, Stability & Shared-Platform Production Certification

P25 is **active**.

The hosted Supabase build upgrade itself remains historically validated. The original generation-1 burn-in was later invalidated by legitimate shared-platform application changes, so P25 has been restarted as **generation 2** against a newly frozen release epoch.

## Hosted upgrade attestation

Historical hosted-upgrade evidence remains unchanged:

- managed build: **17.6.1.127 → 17.6.1.164**
- release channel: **ga → preview**
- PostgreSQL server: **17.6** (`170006`)
- original post-upgrade semantic SHA: `c6a7b8788a3798e3fe119007e55f7d1b5796ece574a27dd10abeb600179a9918`
- semantic format: `platform-p23-shared-schema-v2`
- P18 remains clean
- P20 remains drift-free
- P21 remains pass
- P22 remains pass

PostgreSQL 17.11 remains a separate compatibility/security baseline and is not recorded as the running server version.

## Why generation 1 was restarted

After the hosted upgrade, Gomoku and other shared surfaces continued evolving. That legitimately changed the shared semantic schema, Edge inventory, cron inventory and application-surface counts.

The legacy `private.platform_p24_post_upgrade_validation()` therefore now reports a schema/application-surface mismatch against the immutable post-upgrade snapshot.

That mismatch is expected application evolution. It is **not** treated as evidence that the hosted upgrade failed.

P25 generation 2 separates:

1. immutable historical hosted-upgrade attestation; and
2. the current frozen shared release epoch used for burn-in.

## Generation 2 frozen epoch

Frozen at:

**2026-10-02T14:32:00.744993Z**

Earliest possible completion:

**2026-10-03T14:32:00.744993Z**

Current epoch:

- project: `ACTIVE_HEALTHY`
- migration: `20261002095255_gomoku_p16_certification_null_fix`
- semantic SHA: `af9cc4acbed9e61bc81f48642f75b1c2e2841ebdf52a5139f14e784e509aecad`
- `gomoku-room`: **v42**
- Edge SHA: `fc63d31db8a51b860fc45aa7148fc864f8b2622fc469e495123e9a950273687d`
- cron: **11/11 active**
- cron runs in the preceding 24h: **4042 succeeded / 0 failed**
- blocking replication slots: **0**
- P18: clean
- P20: drift false
- P21: pass
- P22: pass

At freeze time there had been approximately:

- **279 minutes** without a newer shared migration;
- **283 minutes** without a newer Gomoku Edge deployment.

The required quiet period is therefore satisfied.

## Backup evidence

Latest encrypted P15 off-site backup:

- workflow: `P15 Encrypted Offsite Backup`
- run: **36995722053**
- created: **2026-10-02T10:29:08Z**
- conclusion: **success**

This backup occurred after the final P16 shared migration/Edge deployment and before the epoch freeze.

## Burn-in requirements

Generation 2 requires a minimum 24-hour burn-in plus:

- at least 12 successful public samples spanning the window;
- no shared migration/Edge/cron epoch change during the window;
- no unresolved functional outage;
- no sustained material latency regression;
- zero new unexplained cron failures;
- P18 remains clean;
- P20 remains drift-free;
- P21 remains pass;
- P22 remains pass;
- Auth, Realtime, PostgREST, Storage and required Edge Functions remain healthy;
- cross-app smoke checks remain good;
- advisors are reviewed at closure;
- PostgreSQL 17.11 hazards remain separately reviewed;
- the successful post-final-change encrypted backup remains available.

A current `platform_p24_post_upgrade_validation()` pass is **not** required for generation 2 because that function compares current application surfaces with the immutable upgrade-era snapshot. The historical hosted-upgrade attestation must remain valid.

## Performance baseline

| Metric | Pre-upgrade median | Pre-upgrade p95 | Warning threshold |
| --- | ---: | ---: | ---: |
| Auth | 371.5 ms | 710.8 ms | 1422 ms |
| Database | 561.5 ms | 1049.6 ms | 2100 ms |

Individual health checks fail at 4000 ms. A single warning does not fail P25; sustained or functional regression does.

## Hourly evidence

`.github/workflows/p25-post-upgrade-burnin.yml` continues to run on `main` and records the minimum 24-hour burn-in evidence:

- Diet production shell reachability;
- Auth health;
- `platform-health`;
- Auth/database latency;
- denial of service-only P23/P24 operator RPCs.

Artifacts are retained for 30 days.

Because GitHub's nominal hourly schedule was observed to deliver substantially fewer runs than requested, generation 2 keeps the original `17 * * * *` trigger and adds `7,27,47 * * * *`. This changes only sampling opportunity density; the ≥12-successful-samples and full-window evidence rules are unchanged.

## Completion

Generation 2 is **not complete yet**.

If the frozen migration, semantic schema, Edge deployment or relevant cron inventory changes before certification, this generation is invalidated and a new freeze/burn-in generation is required.
