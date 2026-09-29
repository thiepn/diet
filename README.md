# Diet Copilot

**Web 2.0.3 · P22 long-term operability & supply-chain hardening**

Diet Copilot 2.0 remains live at **https://thiepn.dev/diet/**. P22 surrounds the P13–P21 production stack with long-term maintenance, dependency and upgrade controls.

## P22

Production now has a private weekly maintenance audit at **04:07 UTC every Sunday**. It checks scheduler health, seven expected Diet database jobs, recent cron failures, extension-version drift, snapshot freshness, P18 integrity, P20 schema drift and P21 incident readiness.

Diet-owned `cron.job_run_details` history older than **90 days** is pruned automatically. The cleanup is intentionally scoped to current `diet-%` job IDs so unrelated applications in the shared Supabase project are untouched. P22 audit evidence is retained for **730 days**.

### Supply chain

All external GitHub Actions are pinned to reviewed immutable commit SHAs. Floating refs such as `@v6` are prohibited by CI.

`supply-chain.lock.json` protects:

- reviewed GitHub Action commits;
- the vendored Supabase JS runtime;
- the exact Supabase JS SHA-256;
- the Playwright CI version.

The production Supabase browser SDK remains vendored at **2.116.0** with SHA-256:

`fbde52aab1700a3b308087ae78b41fb5192e7a952d81d5d08238763ce3245dd8`

Dependabot checks GitHub Actions weekly. A monthly P22 workflow checks upstream Action tags and the latest Supabase JS release, but updates remain review-only.

### PostgreSQL maintenance

The shared Supabase project currently reports PostgreSQL **17.6**. Diet's preflight for the available 17.11 security update is clean: no `ltree`/`btree_gist` exposure, no affected custom operators and no Diet legacy pgcrypto PGP encryption.

P22 does **not** automatically upgrade the shared database. Other THIEPN applications must be reviewed before the infrastructure upgrade is started.

## Production hardening stack

- **P13:** operational telemetry and degraded-mode reliability
- **P14:** authorization/RLS
- **P15:** recovery snapshots and encrypted off-site backup
- **P16:** read/performance architecture
- **P17:** privacy/export/lifecycle
- **P18:** integrity constraints and auditing
- **P19:** concurrency/idempotency
- **P20:** schema drift and release checkpoints
- **P21:** failure injection and incident recovery
- **P22:** long-term maintenance and supply-chain hardening

## Release

- Web/PWA: **2.0.3**
- Operations: **P22.0**
- Security: **P14**
- Resilience: **P15**
- Performance: **P16**
- Privacy/lifecycle: **P17**
- Data integrity: **P18**
- Concurrency/idempotency: **P19**
- Change governance: **P20**
- Incident/recovery certification: **P21**
- Maintenance/supply chain: **P22**

See [P22 maintenance](docs/P22-MAINTENANCE.md), [P22 supply-chain policy](docs/P22-SUPPLY-CHAIN.md), [P22 upgrade playbook](docs/P22-UPGRADE-PLAYBOOK.md), and [QA.md](QA.md).
