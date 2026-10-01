# P24 — Managed Hosted Upgrade — COMPLETE

P24 is complete.

## Result

The Supabase Dashboard **Upgrade project** operation completed and the hosted project was rebuilt successfully.

- hosted database build: `17.6.1.127` → `17.6.1.164`
- release channel: `ga` → `preview`
- PostgreSQL reports: `17.6` / `170006`
- postmaster restart: `2026-10-01T07:54:44.803638Z`
- P24 post-upgrade validation: **pass**
- semantic schema SHA: `c6a7b8788a3798e3fe119007e55f7d1b5796ece574a27dd10abeb600179a9918`
- semantic fingerprint format: `platform-p23-shared-schema-v2`

The hosted build upgrade and the upstream PostgreSQL 17.11 compatibility/security baseline are now tracked separately. The Dashboard upgrade did not change `server_version` from 17.6 to 17.11.

## Validation

`private.platform_p24_post_upgrade_validation()` currently requires and confirms:

- the recorded hosted upgrade event is validated;
- the database restart matches the upgrade event;
- semantic shared-schema fingerprint matches the post-upgrade attestation;
- application relation/function surface counts match the pre-upgrade baseline;
- P23 hazard preflight passes;
- P18 integrity is clean;
- P20 Diet schema drift is false;
- P21 readiness passes;
- P22 maintenance passes;
- all eight cron jobs exist and are active;
- no cron failures are present in the validation window;
- PostgreSQL major version remains 17+.

A service-only wrapper is available as `public.platform_p24_post_upgrade_status()`.

## Fingerprint v2

The pre-upgrade v1 fingerprint serialized RLS policy roles using internal OIDs. Because OIDs may change across a hosted rebuild, v1 could report false drift.

Migration `20261001121450_platform_p24_post_upgrade_hosted_build_validation` upgraded the shared contract to v2 and records sorted role names rather than OIDs.

## Application/service validation

Post-upgrade evidence includes successful Auth requests, Realtime health 200 responses, PostgREST traffic, Storage traffic, all Edge Functions ACTIVE, and read-only smoke checks across the shared THIEPN application surfaces.

P25 burn-in is now active. See `P25-POST-UPGRADE-BURN-IN.md`.
