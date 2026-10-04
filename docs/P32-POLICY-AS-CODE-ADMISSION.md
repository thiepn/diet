# P32 — Policy-as-Code Enforcement, Automated Change Admission & Fleet Guardrails

P32 is **active by explicit operator override** as an engineering phase.

The phase implements a real policy-as-code admission engine but starts in **warn mode**. Policy decisions are deterministic and visible, while P32 itself does not silently promote its own mode to merge-blocking enforcement.

## Current mode: **warn**

P32 modes are:

`shadow → warn → enforce → production`

Current behavior:

- evaluate every governed manifest;
- emit `admit`, `block`, or `escalate`;
- record would-block/would-escalate evidence;
- keep the P32 PR workflow non-blocking;
- require a separate reviewed bundle change before `enforce`.

The policy engine cannot approve its own enforcement activation.

## Current fleet baseline

Observed on 2026-10-03:

- production project: `ACTIVE_HEALTHY`
- organization plan: `free`
- migration: `20261003105645_gomoku_p20_production_slos_error_budgets`
- semantic schema fingerprint: `5b7b1caddef09b97f59c85d79d04eabfbe55120fe1754340a7367c1b14d39375`
- Edge Functions: **12**
- `gomoku-room` v48
- cron jobs: **14**
- registered apps: **7**
- dependency-graph coverage: **94.44%**
- registered-app governance coverage: **85.71%**
- release epoch: `moving`
- P31 release safety: `amber`
- hosted branch action state: `MIGRATIONS_FAILED`

Production health remains **green**. Release safety remains **amber**.

## Semester OS

`semester-os` exists in the live account registry but remains **observed but unmodeled** in P28/P29.

P32 therefore blocks Semester OS change admission with `P32-OWN-001`.

P32 does not infer its database, Auth, Realtime, Storage, or Edge dependencies. Those dependencies must be explicitly governed first.

The presence of Semester OS also prevents shared/stateful changes from being automatically admitted while fleet-wide dependency coverage remains incomplete.

An unrelated governed `app_fast` change can still be admitted when its scopes do not intersect current drift.

## Deterministic outcomes

### `admit`

The change may enter the governed release flow.

It may still require:

- P29 impact and compatibility evidence;
- P30 immutable candidate and promotion gates;
- P31 `can-release`;
- explicit production approval.

An P32 `admit` **does not grant production approval**.

### `block`

A hard policy or required governance condition fails.

Examples:

- unknown/unmodeled component;
- stale policy/fleet/release registry version;
- change scope intersects live drift;
- shared release during incomplete dependency coverage;
- exposed Data API table without RLS;
- client service-role/secret credential;
- incomplete breaking-provider consumer set.

### `escalate`

The change may be legitimate, but a human/platform/incident decision is required.

Examples:

- paid resource without current-cost approval;
- direct production mutation;
- destructive data/recovery action;
- policy-engine modification.

## Policy bundle

Current bundle:

- version: `2026-10-03.2`
- stable policies: **23**
- non-waivable policies: **21**
- default decision: `block`
- mode: `warn`

Every finding contains:

- stable policy ID;
- category;
- severity;
- effect;
- waiver status;
- evidence.

Every decision binds:

- exact policy bundle SHA-256;
- exact manifest SHA-256;
- deterministic admission receipt ID.

## Registry binding

A manifest must bind the exact current:

- policy bundle version;
- P31 fleet registry version;
- P31 release registry version.

Stale registry identity cannot authorize a new change.

This prevents a PR from presenting an old green fleet snapshot after production or governance has moved.

## Fleet and release guardrails

### Scoped amber

P32 does not turn P31 amber into a fleet-wide freeze.

Notes or Diet frontend-only `app_fast` work may admit if its scopes are unrelated to current drift.

### Gomoku drift

A Gomoku change intersecting:

- `app:gomoku`;
- `edge:gomoku-room`;
- related moving scopes

is blocked while the post-P30 Edge epoch remains unresolved.

### Shared/stateful changes

Shared/stateful admission requires:

- complete dependency-governance coverage;
- stable shared release epoch;
- appropriate P30 stateful train;
- eligible isolated stateful environment strategy.

Current fleet state therefore blocks shared/stateful admission.

## Free-plan environment rules

P32 understands the P30 topology.

Accepted stateful strategies include:

- `local_supabase_ephemeral`;
- explicitly approved isolated Supabase project;
- hosted Supabase branch when actually eligible.

`local_supabase_ephemeral` is valid as a free-plan strategy.

Hosted Supabase Branching is currently rejected because:

- the organization is Free;
- the current branch action state is `MIGRATIONS_FAILED`.

P32 validates that a viable integration strategy exists. P30 later verifies that the exact candidate was actually exercised in that environment.

## Supabase security guardrails

P32 encodes current Data API/Auth safety boundaries.

### Client credentials

Browser/client code containing a service-role or secret Supabase credential is non-waivably blocked.

### Authorization metadata

User-editable metadata may not be treated as an authorization source.

Authorization should rely on server-controlled records or controlled JWT/custom-claim mechanisms.

### RLS

A new Data API table/view must explicitly enable RLS before admission.

### API exposure

A new public Data API object must carry an explicit grant/revoke exposure decision.

This aligns with P28's Data API exposure governance rather than relying on historical automatic grants.

### Functions

A new public function must explicitly decide EXECUTE privileges.

A `SECURITY DEFINER` function additionally requires:

- restricted callable roles;
- declared authorization design.

## Supply-chain policy

Production GitHub Actions must remain pinned to immutable commit SHAs.

This rule is one of the small set of temporarily waivable policies because a tightly scoped compatibility exception may occasionally be required.

The exception remains bounded by the exception model below.

## Compatibility and train routing

Breaking provider changes require completed P29 impact evidence and all transitive consumers represented by the P29 graph.

A shared/stateful change may not declare `app_fast`.

P32 detects routing mistakes before a P30 candidate is cut.

## Exceptions

A valid exception requires:

- exact exception ID;
- exact policy IDs;
- exact scopes;
- matching owner;
- independent approver;
- reason;
- reference;
- creation timestamp;
- expiration timestamp.

Maximum lifetime: **168 hours**.

Not allowed:

- wildcard policies;
- wildcard scopes;
- self-approval;
- requester self-approval;
- future-dated exception creation;
- expired exceptions;
- lifetime above 168 hours;
- attempts to waive a non-waivable policy.

Expired exceptions remain evidence but are ignored for admission.

## Non-waivable controls

Core safety and governance controls cannot be overridden by an exception.

They include, among others:

- ungoverned components;
- stale registry identity;
- incomplete shared dependency coverage;
- moving shared epoch;
- direct production mutation;
- destructive data/recovery operations;
- secret/service-role exposure;
- user-editable metadata authorization;
- missing RLS;
- missing public-object exposure decisions;
- policy-engine self-approval.

## Policy self-protection

Changes touching the P32 bundle, admission engine, or admission workflow always escalate through `P32-POLICY-001`.

The engine cannot edit itself and return `admit` for that edit.

Mode promotion is also not automatic.

## P31 relationship

P32 is an admission gate.

It does not replace P31.

If a manifest claims it already has P31 release eligibility, P32 verifies that the supplied P31 decision is an actual `allow` and binds the same candidate/scopes.

Normal admission does not require a P31 decision yet because P31 runs later in the release flow.

## Automation boundary

P32 may:

- evaluate manifests;
- classify policy findings;
- validate exceptions;
- issue deterministic admission receipts;
- surface warnings.

P32 may not:

- grant production approval;
- promote production;
- mutate production;
- create paid resources;
- self-promote from warn to enforce.

The current workflow is intentionally warn-only.


## P36 registry reconciliation — 2026-10-04

P32 remains in **warn** mode.

P36 onboards `semester-os` into P28/P29/P31 governance and refreshes P32's registry bindings:

- P29 graph: `2026-10-04.1`
- P31 fleet registry: `2026-10-04.1`
- P31 release registry: `2026-10-04.1`
- dependency coverage: **100%**
- registered-app governance coverage: **100%**
- unmodeled components: **0**

This is registry reconciliation only. It does not grant production approval and does not switch P32 to enforce mode.


## P37 policy-binding refresh — 2026-10-04

P32 remains **warn** mode.

Its current bundle/registry binding is:

- policy bundle: `2026-10-04.2`
- fleet registry: `2026-10-04.2`
- release registry: `2026-10-04.2`
- dependency graph: `2026-10-04.1`
- latest merged governance phase: P36
- shared release state: `refreeze_pending_generation5`

This refresh records current facts only. It does not promote P32 to enforce mode or grant production approval.


## P39 policy binding — 2026-10-04

P32 remains **warn** mode.

Current binding:

- policy bundle: `2026-10-04.3`
- fleet registry: `2026-10-04.3`
- release registry: `2026-10-04.2`
- dependency graph: `2026-10-04.1`
- live migration: `20261004173117_gomoku_p23_security_admission_gate`
- `gomoku-room`: v50
- shared epoch: `refreeze_pending_generation5_candidate_revision2`

This is an evidence refresh only. It does not promote P32 to enforce mode or approve a production mutation.
