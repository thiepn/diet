# P30 — Ecosystem Release Trains, Environment Promotion & Coordinated Rollout Certification

P30 is **staged, not active**.

Dependency chain:

**P25 → P26 → P27 → P28 → P29 → P30**

P29 determines *what is affected and what must pass*. P30 determines *what exactly is being promoted, through which environment, in which order, and when that rollout is complete*.

## Why P30 is needed

P29's own live snapshot became stale before P30 was staged:

| Signal | P29 snapshot | Current P30 observation |
| --- | --- | --- |
| Migration | `gomoku_p9_competitive_operations` | `gomoku_p10_competitive_identity` |
| Semantic schema SHA | `25749e27…` | `2d95021a…` |
| gomoku-room | v30 | **v32** |
| Cron jobs | 9 | 9 |

This is not treated as an error in Gomoku. It demonstrates that a release candidate must be immutable. If shared production changes after a candidate is cut, that candidate becomes stale and a **new candidate** is required.

## Environment topology

### CI

Logical isolated validation environment.

Suitable for:

- builds;
- static frontend changes;
- P29 dependency impact;
- compatibility contracts;
- deterministic release tooling.

CI alone is **not enough** to certify a stateful shared backend change.

### Preview

An isolated Supabase branch used for database/Auth/Storage/Realtime/Edge integration testing.

Current state: **not provisioned**.

Supabase documents that branches have isolated databases, Auth, Storage and API credentials, and do not copy production data by default. P30 preserves that isolation.

A branch may only be created after P28 cost approval and Supabase's explicit branch-cost confirmation flow. P30 does not create one automatically.

### Staging

Optional persistent Supabase branch for long-lived QA/staging.

Current state: **not provisioned**.

It is not justified yet merely because the ecosystem has many apps.

### Production

Canonical project:

`hycegznamzjhwinegaai / THIEPN Account`

Project service state is currently **ACTIVE_HEALTHY**.

The Supabase branch registry separately reports the default `main` branch action state as `MIGRATIONS_FAILED` while its preview project status is `ACTIVE_HEALTHY`. P30 treats those as distinct signals. Production health is not declared failed, but **branch-based promotion remains blocked until the branch-action state is understood/resolved**.

## Train types

### app_fast

For a consumer-only app release that does not change a shared provider, schema, identity contract or shared Edge contract.

Stateful Supabase preview: not required.

### shared_standard

For backward-compatible shared-provider or shared operational releases.

Stateful preview: **required**.

### coordinated_breaking

For breaking provider/infrastructure changes.

Requires:

- isolated stateful preview;
- P29 transitive consumer matrix;
- maintenance window;
- explicit production approval.

### platform_maintenance

For hosted DB/Auth/Realtime/Storage/Edge-runtime maintenance.

Uses the strongest applicable environment and operational gates.

## Immutable release candidates

A candidate identity includes:

- train ID;
- candidate ID;
- Git SHA;
- P29 graph version;
- change-manifest SHA;
- impact-analysis SHA;
- semantic schema SHA;
- migration head;
- Edge inventory SHA;
- cron inventory SHA;
- environment-topology version.

If any immutable field changes, P30 does **not** update the candidate in place.

It creates a new candidate.

## Promotion stages

`source → candidate → integration → production_ready → production → observation → certified`

Stage skipping is prohibited.

### Integration rules

Frontend-only consumer changes may use logical CI integration.

Shared stateful changes require an isolated Supabase environment. A passing CI suite cannot substitute for actually applying and exercising the migration/config/Edge combination in isolation.

## Production rollout

P30 does not pretend that deployment mechanisms support canaries when they do not.

### Database schema

There is no partial-schema canary inside one production PostgreSQL database.

Database rollout uses:

**expand → migrate → contract → observe**

### Edge Functions

No percentage-based traffic canary is currently configured. P30 therefore records Edge rollout as all-or-nothing unless a real routing mechanism is introduced later.

### Frontend

No traffic-percentage canary is currently configured for Diet. P30 does not claim one.

## Observation windows

Minimum post-production observation:

- app_fast: 30 minutes
- shared_standard: 60 minutes
- coordinated_breaking: 120 minutes
- platform_maintenance: 120 minutes

These are train-completion holds, not background promises from ChatGPT.

## Stop conditions

Promotion/closure stops when:

- a required health check fails;
- user-facing 5xx regress;
- the P29 certificate becomes stale;
- semantic schema/migration/Edge/cron inventory differs from the candidate;
- P18 integrity fails;
- P20 detects unexpected drift;
- P21 readiness fails;
- P22 maintenance fails.

## Rollback

For stateful database changes the default recovery strategy is **forward fix**, not destructive rewind.

Supabase correctly warns that database rollback can lose writes made after the rollback point. Therefore:

- compatible frontend/code rollback is allowed;
- compatible Edge rollback is allowed;
- database restore/PITR is an incident decision, not a normal release button;
- destructive recovery requires explicit approval and P15 recovery evidence.

## Branching cost and safety

Supabase branches are separate environments and consume their own resources. P30 therefore inherits P28's rule:

**no automatic preview/staging environment creation.**

Before creation:

1. obtain current Supabase branch cost;
2. explicitly confirm the cost;
3. verify the train requires stateful integration;
4. use synthetic/seed data, never copied production user data;
5. delete an ephemeral preview when the train closes.

## P30 activation

P30 remains `staged_pending_p29`.

It cannot become active until P29 is certified, the shared release epoch is stable, and a healthy stateful integration environment exists for shared backend releases.
