# P23 — Shared-Platform Upgrade Certification & Cross-App Infrastructure Readiness

Date: 2026-09-30.

Browser release remains **Web 2.0.3**. Operations release: **P23.0**.

P23 certifies the shared Supabase project for the PostgreSQL 17.11 minor/security upgrade. It does **not** execute the infrastructure upgrade.

## Shared project inventory

Registered THIEPN Account applications:

- Notes
- Diet Copilot
- WORDSTRIKE
- Word to the Nations
- TMS60

Additional database/service surfaces sharing the project:

- THIEPN Account platform
- Canvas
- Gomoku
- Leaderboard service
- Micro Arcade

P23 also has its own platform-control surface used only for upgrade certification.

The final database certification covers **10 application/service surfaces plus one platform-control surface**.

## Upgrade hazard result

Every PostgreSQL 17.11 detection gate is clear:

- ltree indexes: 0
- btree_gist float indexes: 0
- custom operators with non-built-in estimators: 0
- legacy pgcrypto PGP/cipher references in application functions: 0
- app-owned reg* columns: 0
- deprecated PostgreSQL 17 extensions: 0
- extension version mismatches: 0
- md5 login roles: 0
- logical replication slots: 0

The project uses UTF-8/ICU, but no ltree indexes exist, so the ltree reindex issue is not applicable.

## Shared schema fingerprint

P23 fingerprints all app-owned relations and functions in:

- public
- private
- notes_private
- wttn_private
- canvas_admin

It also includes application RLS policies, constraints, indexes, triggers, cron definitions, and installed extension names.

Managed Supabase schemas such as auth, storage and realtime are not treated as application-owned schema.

Certified SHA-256:

`aa4aede72f4d2b3ae75b581f691ee6fa1c993a71279c836a8e1fe9b967e13e64`

## Concurrent-change handling

During P23, Gomoku migration `20260930000816_gomoku_p3_player_presence_and_vacant_host_seats` landed in the shared database.

P23 detected the resulting relation-count change before final certification. The final fingerprint was generated after that migration and therefore includes `gomoku_room_player_presence`.

This is intentional: a shared-infrastructure upgrade baseline must represent the actual final shared project, not an earlier snapshot.

## Edge Functions

The PostgreSQL fingerprint cannot include Supabase Edge Function source.

P23 therefore records an independent external inventory in `platform-p23-inventory.json`.

The certification snapshot contains **11 active Edge Functions**, including platform-health, Gomoku, leaderboard, Wordstrike and Diet functions, with their deployed versions and SHA-256 identifiers.

## Current result

- current PostgreSQL: 17.6
- target PostgreSQL: 17.11
- shared preflight: pass
- safe to schedule upgrade: true
- infrastructure upgrade executed: false
- post-upgrade validation: pending
- P23 advisor security findings: 0
- P23 advisor performance findings: 0
- Diet P18 integrity: clean
- Diet P20 drift: false
- Diet P21 failure certification: pass
- Diet P21 readiness: pass
- Diet P22 maintenance: pass

## Why P23 stops before upgrading

The Supabase database is shared by several independently evolving applications. A PostgreSQL infrastructure upgrade creates a real maintenance window and affects all of them at once.

P23 therefore makes the go/no-go decision reproducible but leaves the actual upgrade for a dedicated execution phase.

The next execution phase must freeze relevant writes, capture fresh backups, confirm no new shared-schema change has invalidated the P23 fingerprint, perform the Supabase Infrastructure upgrade, then run P23 post-upgrade validation plus live application smoke tests before reopening writes.
