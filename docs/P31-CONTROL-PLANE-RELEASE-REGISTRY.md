# P31 — Ecosystem Control Plane, Release Registry & Fleet-Wide Operational Coordination

P31 is **staged, not active**.

Dependency chain:

**P25 → P26 → P27 → P28 → P29 → P30 → P31**

P31 is the coordination layer above the contracts created in P28–P30. It does not replace them:

- P28 owns lifecycle, ownership and governance;
- P29 owns dependency impact and compatibility;
- P30 owns immutable candidates and environment promotion;
- P31 provides one fleet-wide answer about current state and whether a train may advance.

## Current fleet status

Current control-plane state: **amber**.

Production itself remains `ACTIVE_HEALTHY`; amber means release coordination is unsafe, not that the application fleet is down.

Latest observed release epoch:

- migration: `20261001154723_gomoku_p11_social_cron`
- semantic schema SHA: `717bbdd5c015430246a443e9ee3fe3820111add7d7d63c42d7cd00429051fa4b`
- `gomoku-room`: **v35**
- gomoku-room SHA: `20a9b9edc5f9a31f4b21c178fec0b24347ea86dc875b3c66701f1750c2e0e3a9`
- cron jobs: **10**
- new observed job: `gomoku-p11-social-tick`

This is the third moving release epoch captured across P29–P31:

1. P29 — Gomoku P9 / v30 / 9 cron
2. P30 — Gomoku P10 / v32 / 9 cron
3. P31 — Gomoku P11 / v35 / 10 cron

Shared promotion remains blocked until there is a 60-minute shared-change quiet window and a new immutable candidate is cut.

## Canonical fleet registry

`platform-p31-fleet-registry.json` records 17 governed nodes:

### Platform

- Database
- Auth
- Data API
- Realtime
- Storage
- Edge Runtime

### Shared services

- Account
- Leaderboard
- Micro Arcade
- Canvas
- Platform Control

### Registered applications

- Notes
- Diet
- Wordstrike
- Gomoku
- WTTN
- TMS60

Every node has an owner, class, lifecycle, criticality and release scope. The fleet node set must exactly match P29's dependency graph.

## Release registry

`platform-p31-release-registry.json` gives one place to determine phase state.

Current state:

- P25 — `restart_required`
- P26 — PR #17 / `staged_pending_p25`
- P27 — PR #18 / `staged_pending_p26`
- P28 — PR #19 / `staged_pending_p27`
- P29 — PR #20 / `staged_pending_p28`
- P30 — PR #21 / `staged_pending_p29`
- P31 — `staged_pending_p30`

All future phases remain draft-only.

## Desired vs observed state

P31 follows a strict order of authority:

1. live production observation;
2. immutable P30 rollout certificate;
3. immutable P29 compatibility certificate;
4. reviewed Git release registry;
5. staging/planning documents.

Git is the source of **desired** control-plane state.

Supabase is the source of **observed** production state.

If they differ, P31 does not rewrite Git automatically and does not pretend the older registry is true. It reports drift and blocks the affected release.

## Fleet states

### Green

- stable release epoch;
- no functional/security/integrity blocker;
- no unresolved conflicting lock;
- candidate/certificates current.

### Amber

Production is healthy, but release coordination is constrained.

Examples:

- moving release epoch;
- stateful preview unavailable;
- governance ownership unresolved;
- certification quiet window incomplete.

Current state is amber.

### Red

Used only for actual operational failure such as:

- functional outage;
- P18 integrity failure;
- security failure;
- active incident;
- critical recovery state.

A release conflict by itself is not labelled red.

## Coordination modes

P31 recognizes:

- `normal`
- `release_train_active`
- `certification_quiet`
- `maintenance`
- `incident`
- `epoch_moving`

Current mode: **epoch_moving**.

## Coordination scopes

Examples:

- `platform_global`
- `database_schema`
- `identity_contract`
- `realtime_contract`
- `platform_control`
- `environment:preview`
- `app:gomoku`
- `edge:gomoku-room`
- `cron:gomoku`
- `observation:<trainId>`

Release intents carry explicit scopes. This prevents a global freeze when only one unrelated application is changing.

## Lock/lease model

Operational locks are scoped leases, not permanent flags.

Every lease declares:

- ID;
- owner;
- reason;
- scopes;
- expiration.

Rules:

- `platform_global` conflicts with everything;
- matching scopes are exclusive by default;
- a shared-provider lock conflicts with releases that require that provider;
- expired locks remain evidence but do not authorize or block a new action;
- locks are never silently stolen;
- an incident lock preempts normal release promotion.

P31 staging does not acquire production locks automatically.

## “Can this release proceed?”

`scripts/p31-control-plane.py can-release` combines:

- train type;
- explicit release scopes;
- P29 certificate state;
- P30 promotion-gate state;
- current fleet epoch;
- observed fleet blocks;
- unresolved resources touched by the release;
- active leases;
- manual production approval where required.

### Moving epoch

Stateful shared trains are blocked while the release epoch is moving.

An `app_fast` train **may still proceed** if:

- P29/P30 gates pass;
- its scopes do not intersect the moving scopes;
- it touches no unresolved governance resource;
- no active lease conflicts.

This avoids unnecessarily freezing Notes or Diet frontend-only work because Gomoku is changing its own shared backend surfaces.

## Current observed blocks

### shared-epoch-moving

Scopes:

- `database_schema`
- `app:gomoku`
- `edge:gomoku-room`
- `cron:gomoku`

### supabase-main-branch-action-failed

The Supabase branch registry still reports:

`main: MIGRATIONS_FAILED`

while production is `ACTIVE_HEALTHY`.

This blocks remote branch promotion, not ordinary production health.

## Unresolved governance

P31 carries P28's unresolved resources forward rather than losing them:

- `public.change_log` — owner unresolved
- `public.training_distribution_settings` — probable Diet ownership, confirmation required

A release touching an unresolved resource is blocked.

## Control-plane safety boundary

P31 may autonomously:

- read live state;
- read registries;
- calculate impact;
- calculate lock conflicts;
- classify fleet state;
- answer release-safety queries;
- produce evidence.

It may not autonomously:

- promote to production;
- create paid Supabase environments;
- mutate schema/config;
- terminate sessions;
- pause/restore;
- perform destructive rollback.

## Activation

P31 remains `staged_pending_p30`.

It cannot become active until P30 is certified, the release epoch is stable, the stateful promotion environment requirement is satisfied, and the fleet/release registries validate at 100% coverage.
