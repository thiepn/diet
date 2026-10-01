# Diet Copilot

**Web 2.0.3 · P24 validated · P25 post-upgrade burn-in active**

Diet Copilot remains live at **https://thiepn.dev/diet/**.

## Current operations state

The managed Supabase **Upgrade project** operation completed successfully. Post-upgrade validation confirmed that the shared THIEPN Account platform remained healthy.

Verified hosted transition:

- Supabase database build: **17.6.1.127 → 17.6.1.164**
- release channel: **ga → preview**
- PostgreSQL server version: **17.6** (`170006`)
- database restart: **2026-10-01 07:54:44 UTC**
- P24 post-upgrade validation: **pass**
- current semantic shared-schema SHA-256: `c6a7b8788a3798e3fe119007e55f7d1b5796ece574a27dd10abeb600179a9918`
- schema fingerprint: **platform-p23-shared-schema-v2**
- P18 integrity: **clean**
- P20 schema drift: **false**
- P21 readiness: **pass**
- P22 maintenance: **pass**
- cron: **8/8 active**, zero failures in the post-upgrade validation
- blocking replication slots: **0**
- application surface counts: **match the pre-upgrade baseline**

The earlier P23 fingerprint used PostgreSQL internal role OIDs inside RLS policy data. Those OIDs can change when Supabase rebuilds a hosted instance even when policy semantics do not. The v2 fingerprint normalizes those roles to stable role names.

## PostgreSQL 17.11 baseline

PostgreSQL **17.11** remains a tracked compatibility/security baseline, but the hosted Supabase upgrade did **not** change the raw SQL server minor from 17.6 to 17.11. The hosted upgrade and the upstream PostgreSQL minor baseline are therefore tracked separately.

## P25 burn-in

P25 began at **2026-10-01 12:14:50 UTC**.

Earliest possible completion:

**2026-10-02 12:14:50 UTC**

P25 requires at least 24 hours of normal production operation, at least 12 hourly health samples spanning the window, a successful first post-upgrade encrypted P15 backup, healthy cron/Auth/Realtime/Edge behavior, clean P18/P20/P21/P22 checks, and no sustained material latency regression.

See [P25 burn-in](docs/P25-POST-UPGRADE-BURN-IN.md), [P24 execution record](docs/P24-UPGRADE-EXECUTION.md), and [QA.md](QA.md).

## Shared surfaces

Registered apps:

- Notes
- Diet Copilot
- WORDSTRIKE
- Word to the Nations
- TMS60
- Gomoku

Additional services sharing the project:

- THIEPN Account platform
- Canvas
- Leaderboard
- Micro Arcade

P23 records the deployed Edge Function inventory separately in `platform-p23-inventory.json`, because Edge Function source is outside PostgreSQL's system catalog.

## Concurrent schema changes

While P23 was running, Gomoku migration `20260930000816_gomoku_p3_player_presence_and_vacant_host_seats` landed in the shared database. P23 detected the new relation before final certification, and the final P23 fingerprint includes it.

That is the intended behavior: a platform upgrade must use the final shared database state, not a stale earlier snapshot.

## Upgrade execution

P23 does **not** automatically alter the managed PostgreSQL version.

The actual infrastructure operation requires a maintenance window and cross-app post-upgrade checks. `private.platform_p23_post_upgrade_validation()` therefore remains **pending** until production is actually on PostgreSQL 17.11 or newer.

## Production hardening stack

- **P13:** operational telemetry and degraded-mode reliability
- **P14:** authorization/RLS
- **P15:** recovery snapshots and encrypted off-site backup
- **P16:** read/performance architecture
- **P17:** privacy/export/lifecycle
- **P18:** integrity constraints and auditing
- **P19:** concurrency/idempotency
- **P20:** Diet schema drift and release checkpoints
- **P21:** failure injection and incident recovery
- **P22:** long-term maintenance and supply-chain hardening
- **P23:** shared-platform PostgreSQL upgrade certification
- **P24:** controlled upgrade execution gate and manual infrastructure handoff (pending execution)

## Release

- Web/PWA: **2.0.3**
- Operations: **P23.0**
- Security: **P14**
- Resilience: **P15**
- Performance: **P16**
- Privacy/lifecycle: **P17**
- Data integrity: **P18**
- Concurrency/idempotency: **P19**
- Diet change governance: **P20**
- Incident/recovery certification: **P21**
- Maintenance/supply chain: **P22**
- Shared-platform upgrade readiness: **P23**

See [P23 certification](docs/P23-UPGRADE-CERTIFICATION.md), [P23 upgrade runbook](docs/P23-UPGRADE-RUNBOOK.md), [post-upgrade validation matrix](docs/P23-POST-UPGRADE-CHECKLIST.md), and [QA.md](QA.md).
