# Diet Copilot

**Web 2.0.3 · P23 active · P24 controlled PostgreSQL upgrade prepared**

Diet Copilot remains live at **https://thiepn.dev/diet/**. P23 remains the active operations release. P24 has prepared the controlled PostgreSQL 17.11 execution boundary, but the managed infrastructure upgrade has **not** been executed yet.

## P24 execution state

P24 added a service-only execution gate, refreshed the shared schema/Edge Function baseline after concurrent Gomoku P4/P5 changes, captured and verified a fresh recovery snapshot, confirmed the latest encrypted off-site backup, and returned Diet to normal writable operation.

The gate requires an exact certified schema match plus a **10-minute migration quiet window** before the manual Supabase Infrastructure upgrade may begin.

Current P24 state: **awaiting quiet window and manual Supabase Infrastructure → Upgrade project action**.

Shared pre-upgrade SHA-256:

`f5485033a2845f9a1baacee6811c976c72e5ffb5d73bf0b9a50e3d0c0b48647c`

See [P24 execution](docs/P24-UPGRADE-EXECUTION.md) and [P24 manual handoff](docs/P24-MANUAL-HANDOFF.md).

## P23 result

The shared project currently runs PostgreSQL **17.6**. Supabase makes **17.11** available as a security/minor upgrade.

P23 certifies:

- **5 registered THIEPN Account apps**;
- **10 application/service database surfaces**;
- **1 platform-control surface**;
- **11 active Edge Functions**;
- **8 active pg_cron jobs**;
- a deterministic cross-app schema fingerprint.

Final P23 database state:

- preflight: **pass**
- safe to schedule upgrade: **true**
- shared schema SHA-256: `aa4aede72f4d2b3ae75b581f691ee6fa1c993a71279c836a8e1fe9b967e13e64`
- detected upgrade hazards: **0**
- infrastructure upgrade executed: **false**
- post-upgrade validation: **pending**

The P23 hazard scan found zero ltree indexes, zero btree_gist float indexes, zero affected custom operators, zero legacy pgcrypto cipher references, zero app-owned reg* columns, zero deprecated extensions, zero extension-version mismatches, zero MD5 login roles and zero logical replication slots.

## Shared surfaces

Registered apps:

- Notes
- Diet Copilot
- WORDSTRIKE
- Word to the Nations
- TMS60

Additional services sharing the project:

- THIEPN Account platform
- Canvas
- Gomoku
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
