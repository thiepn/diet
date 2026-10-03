# P30 — Ecosystem Release Trains, Environment Promotion & Coordinated Rollout Certification

P30 is **active by explicit operator override** as an engineering phase. Earlier time-based gates do not block implementation. P30 still does not authorize production promotion, plan upgrades, paid environment provisioning, or destructive recovery.

P29 determines what is affected and what compatibility evidence must pass. P30 freezes that result into an immutable candidate and controls how the exact candidate may move through environments and rollout stages.

## Current release epoch

Observed on 2026-10-03:

- migration: `20261003105645_gomoku_p20_production_slos_error_budgets`
- semantic schema fingerprint: `5b7b1caddef09b97f59c85d79d04eabfbe55120fe1754340a7367c1b14d39375`
- Edge Functions: **12**
- cron jobs: **14**
- newly observed cron: `gomoku-p20-slo-sample`

This supersedes the earlier P29 snapshot as a candidate baseline. P29's tooling remains valid; a new candidate simply binds to the new epoch.

## Current environment reality

The organization is on the **Free plan**.

Current Supabase documentation says hosted Branching requires **Pro**. Therefore P30 does not model a hosted preview branch as currently available.

The branch registry still contains only the default `main` row:

- branch action status: `MIGRATIONS_FAILED`
- preview project status: `ACTIVE_HEALTHY`

The canonical production project itself is also `ACTIVE_HEALTHY`.

These are separate signals. P30 does not call production unhealthy because a branch-deployment action failed, but it also does not use that branch path for promotion.

## Free-plan stateful validation path

P30 does not weaken stateful release requirements just because hosted Branching is unavailable.

A stateful train may use `local_supabase_ephemeral`: a fresh disposable local Supabase stack that must prove:

- the exact candidate migrations were applied;
- required services are healthy;
- in-scope Edge Functions/configuration were exercised;
- no production user data was copied in;
- the environment is destroyed after use.

This is the preferred free-path for stateful integration.

An isolated Supabase project is also a valid topology in principle, but P30 does not create one automatically. It requires a current resource/cost decision and explicit approval.

Hosted preview branches become eligible only if the organization plan and branch state actually support them.

## Train types

### app_fast

Consumer-only/static release with no shared provider/schema/identity/Edge/cron contract change.

Logical CI is sufficient for integration.

Minimum production observation: **30 minutes**.

### shared_standard

Backward-compatible shared provider or stateful operational release.

Requires an isolated stateful environment.

Minimum production observation: **60 minutes**.

### coordinated_breaking

Breaking provider/infrastructure change.

Requires:

- isolated stateful integration;
- P29 transitive compatibility evidence;
- explicit maintenance window;
- explicit production approval.

Minimum production observation: **120 minutes**.

### platform_maintenance

Hosted DB/Auth/Realtime/Storage/Edge-runtime maintenance.

Uses the strongest applicable environment and release gates.

Minimum production observation: **120 minutes**.

## Immutable candidate identity

A candidate binds:

- train ID/type;
- Git SHA;
- P29 dependency graph version and SHA;
- P29 certificate ID;
- change-manifest SHA;
- impact-analysis SHA;
- semantic schema fingerprint;
- migration head;
- Edge inventory SHA;
- cron inventory SHA;
- environment topology version.

Changing any of these creates a new candidate. The candidate is never edited in place.

## Promotion stages

`source → candidate → integration → production_ready → production → observation → certified`

Only adjacent forward transitions are valid.

Every promotion decision produces a deterministic promotion receipt bound to:

- candidate ID;
- source/target stage;
- evidence digest.

A stage cannot be skipped by constructing a later-stage evidence file.

## Integration gate

For every candidate:

- P29 certificate status must still be `pass`;
- the P29 certificate ID must exactly match the candidate;
- schema/migration/Edge/cron epoch must still match.

For stateful trains, logical CI alone fails the gate.

Accepted stateful environments:

- `local_supabase_ephemeral`;
- explicitly approved isolated Supabase project;
- hosted Supabase branch, but only when the current plan and branch state make it eligible.

## Production-ready gate

All trains require:

- P29 compatibility;
- security/integrity regression;
- production artifact validation;
- rollback or forward-fix plan.

Stateful trains additionally require P18/P20/P21/P22 checks.

## Production gate

Production promotion always requires explicit human/operator approval with a traceable approval reference.

P30 code does not perform that promotion itself.

`coordinated_breaking` and `platform_maintenance` trains additionally require a declared maintenance window.

## Rollout truthfulness

There is no database schema canary inside one production PostgreSQL database.

No percentage-based Edge or frontend canary is currently configured.

Therefore the default rollout is all-at-once at the relevant deployment surface, with:

**expand → migrate → contract → observe**

P30 rejects a **false canary** claim unless real traffic-routing evidence is attached.

## Stop conditions

Observation/certification fails if any stop condition is active, including:

- health-check failure;
- user-facing 5xx regression;
- stale/mismatched P29 certificate;
- candidate epoch drift;
- P18 integrity failure;
- P20 unexpected drift;
- P21 readiness failure;
- P22 maintenance failure;
- affected-consumer compatibility regression.

## Rollback

Database recovery defaults to **forward fix**.

P30 never turns destructive database rewind into a normal release action. Restore/PITR requires an explicit incident decision and P15 recovery evidence.

Compatible application or Edge rollback is allowed only while provider contracts still support the rolled-back consumer.

Any epoch-changing rollback invalidates the rollout certificate.

## Rollout certificate

A train becomes `certified` only when:

- the exact promotion receipt sequence is present;
- every receipt belongs to the exact candidate;
- production approval evidence is attached;
- production epoch matches the candidate;
- the minimum observation window completed;
- post-release health passed;
- no stop condition is active;
- any claimed canary has real routing evidence.

The resulting rollout certificate receives a deterministic SHA-256 ID.

The certifier **does not promote production**. It only validates and records evidence.
