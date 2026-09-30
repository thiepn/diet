# Diet Copilot

**Web 2.0.3 · P23 active · P24 concurrency-safe PostgreSQL upgrade handoff**

Diet Copilot remains live at **https://thiepn.dev/diet/**. P23 remains the active operations release. P24 has prepared the controlled PostgreSQL 17.11 execution boundary, but the managed infrastructure upgrade has **not** been executed yet.

## P24 execution state

P24 now treats the shared project as a moving production platform rather than a static handoff. After the original handoff, Gomoku P6/P7 and Account migrations changed the database, and `gomoku-room` advanced to v24. The execution gate correctly invalidated the stale certification.

The refreshed gate distinguishes **blocking/custom replication slots** from Supabase-managed temporary Realtime slots, keeps the Supabase Dashboard preflight authoritative, and still requires an exact certified schema match plus a **10-minute migration quiet window**.

Current recorded P24 state: **ready for the manual Supabase infrastructure upgrade**. The final live gate reported an exact schema match with 225+ minutes of migration quiet time; the latest v27 shared Edge deployment was also quiet for well over 10 minutes. The live gate remains authoritative immediately before the Dashboard click.

Current certified shared SHA-256:

`8239b32928be652214a63ae733d42bace71d46d7145e3e6e5eea8b7f066e1dfe`

See [P24 execution](docs/P24-UPGRADE-EXECUTION.md) and [P24 manual handoff](docs/P24-MANUAL-HANDOFF.md).

## P23 result

The shared project currently runs PostgreSQL **17.6**. Supabase makes **17.11** available as a security/minor upgrade.

P23 certifies:

- **6 registered THIEPN Account apps**;
- **10 application/service database surfaces**;
- **1 platform-control surface**;
- **11 active Edge Functions**;
- **8 active pg_cron jobs**;
- a deterministic cross-app schema fingerprint.

Final P23 database state:

- preflight: **pass**
- safe to schedule upgrade: **true**
- shared schema SHA-256: `b2d94e5bfa4cfb06c346a5486ebaa918a86c83737e65879691b241e66c17573f`
- detected upgrade hazards: **0**
- infrastructure upgrade executed: **false**
- post-upgrade validation: **pending**

The P23 hazard scan found zero ltree indexes, zero btree_gist float indexes, zero affected custom operators, zero legacy pgcrypto cipher references, zero app-owned reg* columns, zero deprecated extensions, zero extension-version mismatches, zero MD5 login roles and zero blocking/custom logical replication slots. Supabase-managed temporary Realtime slots are classified separately and the Dashboard eligibility check remains authoritative.

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
