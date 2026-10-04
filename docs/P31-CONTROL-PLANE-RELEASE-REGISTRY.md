# P31 — Ecosystem Control Plane, Release Registry & Fleet-Wide Operational Coordination

P31 is **active by explicit operator override** as an engineering phase. Earlier time-based gates no longer block implementation. P31 still does not authorize production promotion, production mutation, or paid resource provisioning.

P28 defines ownership/lifecycle, P29 defines dependency and compatibility impact, P30 defines immutable candidates and rollout stages, and P31 turns those contracts into one fleet-wide coordination surface.

## Current control-plane state

- Production health: **green**
- Release safety: **amber**
- Fleet state: **amber**
- Coordination mode: `registry_and_epoch_drift`

Production remains `ACTIVE_HEALTHY`. Amber means release coordination has current drift that must be modeled before affected/shared promotion.

## Current live epoch

Observed on 2026-10-03:

- migration: `20261003105645_gomoku_p20_production_slos_error_budgets`
- semantic schema fingerprint: `5b7b1caddef09b97f59c85d79d04eabfbe55120fe1754340a7367c1b14d39375`
- Edge Functions: **12**
- cron jobs: **14**
- `gomoku-room` is now **v48**
- `gomoku-room` SHA: `f0493fe400876a8d52f394724d6e44644978d2028b890c912ec283fdc32154cd`

The database schema/migration/cron surface still matches the P30 snapshot, but the Gomoku Edge epoch moved after P30. Shared/Gomoku release coordination therefore remains amber until a fresh P29/P30 candidate is cut against the current epoch.

## Live fleet discovery

The live account registry now contains **7 active apps**:

- Notes
- Diet
- WORDSTRIKE
- Gomoku
- Semester OS
- WTTN
- TMS60

P28/P29 currently govern only the first six.

`semester-os` is therefore recorded as **observed but unmodeled**:

- live route: `/semester/`
- absent from the P28 ownership registry
- absent from the P29 dependency graph
- no dependency assumptions invented by P31

This is exactly the kind of drift a fleet control plane must expose rather than hide.

Current coverage:

- observed fleet components: **18**
- P29-governed graph nodes: **17**
- dependency-graph coverage: **94.44%**
- active registered apps observed: **7**
- registered apps governed: **6**
- registered-app governance coverage: **85.71%**

A Semester OS release is blocked until ownership and dependencies are explicitly governed.

Shared/stateful trains are also blocked while fleet-wide dependency coverage is incomplete because P31 cannot safely prove the new consumer is unaffected.

An unrelated governed `app_fast` release may still proceed if its own scopes do not overlap current drift.

## Release registry

P31 now records the actual merged governance history:

- P26 → merged as `01f40c2e…`
- P27 → merged as `f4e9c2f2…`
- P28 → merged as `85f23ea6…`
- P29 → merged as `2c1bd74d…`
- P30 → merged as `dd35a668…`
- P31 → current implementation phase

The published Diet operations manifest still reports `P25.0`. P31 exposes that as a warning rather than pretending the public manifest already advertises P31.

## Desired state vs observed state

Git registries are desired governance state.

Supabase is observed production state.

Observed production wins when answering “what is live now,” but P31 never rewrites reviewed Git governance automatically.

`reconcile` compares:

- semantic schema fingerprint;
- migration head;
- cron count;
- Edge Function count;
- Gomoku Edge version/SHA;
- registered app set.

A mismatch produces explicit stale fields and never modifies desired state.

## Registry validity vs release readiness

These are separate concepts.

The P31 registry is structurally valid when:

- all governed P29 nodes exist in the fleet registry;
- merged phase history is internally consistent;
- every observed-but-unmodeled component is explicitly represented as drift;
- automation safety boundaries are intact.

Release readiness can still be false.

Current registry state is structurally valid, while release safety remains amber because of:

1. Semester OS dependency/ownership drift;
2. the post-P30 Gomoku Edge change;
3. the hosted Supabase branch action state.

## Hosted branch state

The Supabase branch registry still reports:

- `main` action state: `MIGRATIONS_FAILED`
- preview-project status: `ACTIVE_HEALTHY`

Production is separately `ACTIVE_HEALTHY`.

P31 blocks only the hosted-branch path from this condition. It does not turn an unrelated app release or production-health status red.

The P30 free-plan `local_supabase_ephemeral` stateful path remains available on demand.

## Fleet release decision

`scripts/p31-control-plane.py can-release` combines:

- exact fleet/release registry versions;
- candidate identity;
- P29 certificate state;
- P30 promotion state;
- governed components;
- explicit scopes/resources;
- current release epoch;
- observed drift;
- active leases;
- target stage;
- traceable production approval.

### Current examples

Notes `app_fast` with `app:notes` may proceed through an unrelated integration decision.

Gomoku `app_fast` is blocked while its Edge scope is moving.

Semester OS is blocked because it is not yet governed in P28/P29.

Shared/stateful trains are blocked while the shared epoch and dependency graph coverage are incomplete.

## Lease coordination

P31 models release, maintenance, certification-quiet and incident leases.

Every lease must include:

- ID;
- type;
- owner;
- reason;
- scopes;
- issue time;
- expiry.

Rules:

- `platform_global` conflicts with everything;
- overlapping active scopes are exclusive by default;
- incident leases preempt conflicting release work;
- expired leases remain evidence but no longer block;
- locks/leases are never silently stolen.

P31 itself does not acquire production-impacting locks automatically.

## Production boundary

A production-stage answer requires:

- current P29 compatibility pass;
- current P30 promotion pass;
- exact current registries;
- no conflicting drift/lease;
- explicit approval;
- a non-empty approval reference.

Even when P31 returns `allow`, it **does not promote production**. It only answers whether the governed evidence permits the next action.

## Safety

P31 may automatically:

- read registries/live state;
- classify fleet state;
- reconcile desired and observed state;
- calculate release/lease conflicts;
- emit evidence.

P31 may not automatically:

- promote production;
- mutate production schema/configuration;
- create paid resources;
- terminate sessions;
- pause/restore projects;
- perform destructive rollback.


## P36 fleet reconciliation — 2026-10-04

The fleet registry is now `2026-10-04.1`.

- observed fleet: **18/18 governed**
- dependency coverage: **100%**
- registered apps: **7/7 governed**
- `semester-os`: **governed**
- `gomoku-room`: v48 is incorporated into the current release epoch rather than treated as unresolved drift
- current epoch: `20261003221217_hub_h15_tms60_projection`
- release registry lineage is reconciled through merged P35

Release safety remains **amber** because the generation-4 epoch is a frozen burn-in candidate rather than a certified stable shared-release epoch. App-fast releases for governed components may proceed through normal gates; shared/stateful trains still block on the unstable/certifying shared epoch. Hosted Supabase preview remains unavailable on the Free-plan path.


## P37 moving-epoch reconciliation — 2026-10-04

The fleet registry is now `2026-10-04.2` and the release registry is `2026-10-04.2`.

The merged governance lineage now runs through **P36**. Fleet/dependency coverage remains 100%.

The live release epoch moved to `20261004132839_gomoku_p21_capacity_admission_gate`, `gomoku-room` v49, and `micro-arcade-p31-backup-export` v2. The shared epoch is therefore `refreeze_pending_generation5`, not stable.

Governed app-fast work may still be evaluated normally. Shared/stateful release trains remain blocked by `shared_epoch_not_stable` until the new P25 generation is legitimately frozen and certified.
