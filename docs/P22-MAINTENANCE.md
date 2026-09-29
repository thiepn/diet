# P22 — Long-Term Operability, Dependency, Supply-Chain & Maintenance Hardening

Date: 2026-09-30. Browser release remains **Web 2.0.3**. Operations release: **P22.0**.

P22 is the maintenance layer around P13–P21. It does not add nutrition features. It makes the existing production system harder to silently decay over months or years.

## Production result

- P22 maintenance report: **pass**
- P20 schema drift: **false**
- P21 failure certification: **15/15 pass**
- P21 readiness: **pass**
- P22-specific security advisor findings: **0**
- P22-specific performance advisor findings: **0**
- active Diet database jobs: **7**
- pg_cron scheduler workers: **1**
- recent Diet cron failures: **0**
- latest P15 snapshot: fresh within 48 hours

## Database maintenance

P22 adds `private.diet_maintenance_audits` and:

- `private.diet_p22_maintenance_report()`
- `private.diet_p22_prune_cron_history(integer)`
- `private.diet_p22_run_maintenance(text)`
- service-only `public.diet_p22_maintenance_status()`

A weekly maintenance job runs **Sunday 04:07 UTC**.

It retains P22 audit records for **730 days** and prunes `cron.job_run_details` older than **90 days**, but only for currently registered `diet-%` jobs. It deliberately does not delete history belonging to other applications in the shared Supabase project.

## Supply chain

Every external GitHub Action in the repository is pinned to a reviewed immutable 40-character commit SHA.

`supply-chain.lock.json` records the reviewed Action commits, vendored runtime hash and CI tool versions.

The production Supabase browser SDK remains local and vendored:

- package: `@supabase/supabase-js`
- reviewed runtime: **2.116.0**
- SHA-256: `fbde52aab1700a3b308087ae78b41fb5192e7a952d81d5d08238763ce3245dd8`
- no remote CDN script is required at runtime

P22 observed a newer Supabase JS release and records it as a review item instead of automatically replacing a known-good production dependency. Runtime dependency upgrades require static checks plus browser/regression certification before the lock changes.

Dependabot checks GitHub Actions weekly. Because the repository also enforces `supply-chain.lock.json`, an Action update must be explicitly reviewed and the lock updated rather than silently following a mutable major tag.

## Monthly upstream watch

The P22 GitHub workflow runs monthly and checks:

- reviewed Action tag targets;
- latest published Supabase JS version;
- vendored file SHA-256;
- remote browser script/import absence;
- pinned Playwright CI version;
- production shell/Auth/public authorization health.

Version changes are surfaced as review warnings rather than automatically deployed.

## PostgreSQL 17.11 readiness

Production currently reports PostgreSQL **17.6**.

The P22 preflight for the announced PostgreSQL 17.11 security update found:

- no `ltree`/ `btree_gist` extension exposure in the project;
- no affected custom selectivity-estimator operators;
- no Diet function using legacy pgcrypto PGP encryption;
- Diet's pgcrypto use is hashing/digest only;
- pg_cron 1.6.4 is installed and matches its current default.

Therefore Diet itself is upgrade-ready. The Supabase project is shared with other THIEPN applications, so P22 does **not** automatically pause, restore or upgrade the production project. A shared-project cross-app review is required before using the Infrastructure upgrade control.

## Non-goals

P22 never:

- auto-upgrades PostgreSQL;
- auto-upgrades browser dependencies;
- auto-merges Dependabot updates;
- prunes another application's cron history;
- exposes maintenance state to normal browser roles;
- changes Web/PWA version 2.0.3.
