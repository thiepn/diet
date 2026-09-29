# P20 — Production Change Safety, Schema Drift Detection & Release Governance

Date: 2026-09-30. Browser release remains Web 2.0.3. Operations release: P20.0.

P20 protects Diet's production database from silent, undocumented schema drift. It does not block Supabase-managed changes or unrelated apps in the shared project, and it does not auto-repair production.

## Why this phase exists

P14–P19 hardened the running application: authorization, recovery, performance, privacy, data integrity and concurrent mutations. A remaining operational risk was a manual or out-of-band schema change that bypassed Diet's migration/review trail.

Supabase's production guidance recommends version-controlled migrations rather than direct Dashboard schema changes. P20 adds an independent Diet-specific contract so accidental drift is detectable even in a shared Supabase project.

## Deterministic schema contract

`private.diet_p20_schema_contract()` creates a canonical JSON representation of Diet-owned database structure.

It covers:

- 18 public Diet data tables;
- 5 private Diet operational tables;
- relation/RLS flags;
- columns and defaults;
- constraints and foreign keys;
- indexes;
- RLS policies;
- non-internal triggers;
- public/private functions whose names start with `diet_`;
- Diet pg_cron jobs.

It intentionally excludes:

- user/table row contents;
- Supabase-managed `auth` and `storage` schemas;
- unrelated THIEPN applications;
- generic platform objects.

That scope prevents unrelated Account/Arcade/Gomoku migrations in the shared project from producing false Diet drift alarms.

## Certified fingerprint

`private.diet_p20_schema_fingerprint()` hashes the canonical contract using SHA-256.

Initial certified fingerprint:

`f5463a8b37e3a0be94c15588037405bbcca75a5f60c5401f0c937b8e5dc13752`

The P20 checkpoint is stored in `private.diet_release_checkpoints` with operations version `P20.0`.

Future intentional Diet schema releases should:

1. apply their version-controlled migration;
2. run the full release tests/advisors;
3. certify the new release checkpoint only after validation.

## Drift audit

`private.diet_p20_run_drift_audit()` compares the current fingerprint with the latest certified checkpoint.

Possible states:

- `clean` — exact match;
- `drift` — current schema differs from certified schema;
- `no_checkpoint` — no certified release exists.

Audit results are stored in `private.diet_schema_drift_audits` for 365 days.

The audit never repairs the schema.

## Scheduled verification

Supabase Cron runs:

`diet-p20-schema-drift-daily`

at **03:37 UTC every day**.

This follows P18's 03:17 integrity audit and P19's 03:27 request-ledger pruning.

## Rollback proof

P20 was tested with a temporary unapproved CHECK constraint inside a PostgreSQL subtransaction.

Results:

- temporary schema mutation changed the fingerprint;
- drift was detected;
- subtransaction rollback restored the exact certified fingerprint;
- probe constraint did not persist.

This verifies both the positive and negative paths without leaving a production mutation behind.

## Access boundary

The checkpoint tables, audit history, schema contract, fingerprint function, certification function and drift runner are private/service-only.

`public.diet_p20_release_status()` exists for trusted operations tooling but is executable only by `service_role`.

Anonymous and authenticated browser roles cannot call it.

## Release status

At certification:

- current fingerprint equals expected fingerprint;
- drift = false;
- last audit = clean;
- latest Diet migration = `20260929221452_diet_p20_schema_drift_release_governance`;
- one daily drift cron exists;
- no P20-specific Supabase security advisor findings;
- no P20-specific Supabase performance advisor findings.

## Operational rule

P20 is detection and certification, not an event-trigger DDL firewall.

The Supabase project is shared by multiple THIEPN applications, so a global event trigger that blocks arbitrary DDL would create unnecessary coupling and could interfere with other applications or managed platform operations. Diet instead fingerprints only its own structural contract and alerts on divergence.

Production schema changes should remain migration-driven and followed by a new certified checkpoint.
