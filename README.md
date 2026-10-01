# Diet Copilot

**Web 2.0.3 · P24 validated · P25 post-upgrade burn-in active**

Diet Copilot is live at **https://thiepn.dev/diet/**.

## Operations

The managed Supabase **Upgrade project** operation completed successfully.

- Supabase database build: **17.6.1.127 → 17.6.1.164**
- release channel: **ga → preview**
- PostgreSQL server: **17.6** (`170006`)
- database restart: **2026-10-01 07:54:44 UTC**
- P24 post-upgrade validation: **pass**
- semantic shared-schema SHA: `c6a7b8788a3798e3fe119007e55f7d1b5796ece574a27dd10abeb600179a9918`
- fingerprint format: **platform-p23-shared-schema-v2**
- P18 integrity: **clean**
- P20 schema drift: **false**
- P21 readiness: **pass**
- P22 maintenance: **pass**
- cron: **8/8 active**
- blocking replication slots: **0**
- application relation/function surface counts: **match the pre-upgrade baseline**

The v2 shared fingerprint normalizes RLS policy roles by stable role names rather than PostgreSQL internal role OIDs, preventing false drift after hosted instance reconstruction.

## PostgreSQL 17.11 compatibility baseline

PostgreSQL **17.11** remains a separately tracked compatibility/security baseline. The hosted Supabase operation upgraded the managed project build but the database still reports PostgreSQL 17.6, so the repository does not claim a 17.11 server version.

## P25 burn-in

P25 is active.

- start: **2026-10-01 12:14:50 UTC**
- earliest completion: **2026-10-02 12:14:50 UTC**
- minimum duration: **24 hours**
- minimum public samples: **12**, spanning the window
- hourly workflow: `.github/workflows/p25-post-upgrade-burnin.yml`

Completion also requires the first encrypted P15 backup after activation, healthy Auth/Realtime/PostgREST/Storage/Edge behavior, clean P18/P20/P21/P22 checks, healthy cron, cross-app smoke coverage, advisor review, and no sustained latency regression.

## Shared platform

Registered THIEPN apps:

- Notes
- Diet Copilot
- WORDSTRIKE
- Word to the Nations
- TMS60
- Gomoku

Additional shared services include THIEPN Account, Canvas, Leaderboard, and Micro Arcade. Edge Functions are inventoried separately because they are outside PostgreSQL's catalog fingerprint.

## Production hardening stack

- **P13:** telemetry and degraded-mode reliability
- **P14:** authorization/RLS
- **P15:** verified recovery snapshots and encrypted off-site backup
- **P16:** read/performance architecture
- **P17:** privacy/export/lifecycle
- **P18:** integrity constraints and auditing
- **P19:** concurrency/idempotency
- **P20:** schema drift and release governance
- **P21:** failure injection and incident readiness
- **P22:** maintenance and supply-chain hardening
- **P23:** shared-platform upgrade readiness and compatibility checks
- **P24:** managed hosted-upgrade execution and post-upgrade validation — **complete**
- **P25:** post-upgrade burn-in and production certification — **active**

## Release

- Web/PWA: **2.0.3**
- Operations: **P25.0**
- P24 validation: **pass**
- P25 state: **burn_in_active**

See [P25 burn-in](docs/P25-POST-UPGRADE-BURN-IN.md), [P24 execution record](docs/P24-UPGRADE-EXECUTION.md), and [QA.md](QA.md).
