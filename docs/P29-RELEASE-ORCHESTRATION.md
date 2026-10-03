# P29 — Cross-App Release Orchestration, Dependency Graph & Compatibility Certification

P29 is **staged, not active**.

Dependency chain:

**P25 → P26 → P27 → P28 → P29**

P29 turns P28's ownership/governance model into an executable release protocol. It answers four questions for every shared change:

1. **What changed?**
2. **Who consumes it, directly or transitively?**
3. **In what order may providers and consumers deploy?**
4. **What evidence is required before the release is certified?**

## First real incident detected by P29

P29 immediately detected a live example of the problem it is designed to prevent.

After the P25 burn-in baseline was created, Gomoku continued changing the shared Supabase project:

- latest migration: `20261001142949_gomoku_p9_competitive_operations`
- current semantic schema SHA: `25749e27870c65113b7ddd2a9ad2724c6eb1622f17a44b4f57977bf01cda9d02`
- `gomoku-room`: v30
- cron jobs: 9
- new cron: `gomoku-p9-competition-tick`

The prior P25 baseline had:

- semantic SHA: `c6a7b8788a3798e3fe119007e55f7d1b5796ece574a27dd10abeb600179a9918`
- cron jobs: 8

Therefore the existing P25 burn-in is **not certifiable** as a continuous post-upgrade stability window. Once current shared changes settle, the shared platform needs a fresh baseline and a restarted burn-in window.

The old P24 validator now reports fail because it compares against the immediate post-upgrade attestation. This does **not** mean the hosted upgrade was undone; it means later legitimate shared changes made that historical snapshot stale.

## Dependency graph

P29 models platform providers, shared services and registered apps separately.

Key direct dependencies include:

- all registered apps → shared Auth
- all registered apps → Account lifecycle/identity contract
- Wordstrike → shared Leaderboard service
- Gomoku → Account grants/connections
- Gomoku → Leaderboard profiles
- Gomoku → Realtime
- Canvas → Storage
- Edge-backed services → Edge Runtime
- all persisted services → Database/Data API

The Gomoku dependencies are verified from the live `gomoku-room` Edge Function: it validates `/auth/v1/user`, reads Account connection/grant tables, and reads `leaderboard_profiles`.

## Change classes

### Provider additive

A backward-compatible provider addition.

Required impact: provider + **direct consumers**.

Release pattern:

1. provider deploys compatible capability;
2. old consumers continue working;
3. direct consumers certify/use new capability.

### Provider breaking

A provider removes or changes an existing contract.

Required impact: provider + **all transitive consumers**.

Default release pattern is **expand → migrate → contract**:

1. add new contract while old remains valid;
2. certify provider;
3. migrate every consumer;
4. certify full matrix;
5. only then remove old contract.

### Consumer-only

Only the changed consumer requires release certification unless it changes a shared contract.

### Data migration without contract change

Requires the resource owner plus platform-control/integrity validation.

### Infrastructure contract

Auth, Data API, Realtime, Storage, database-platform or Edge-runtime contract changes require the full transitive consumer matrix.

### Operational job

Cron/background-job changes require the owner and platform-control operational checks. A cron inventory change also invalidates a release-epoch certificate if the job is in scope.

## Release waves

P29 formalizes every coordinated shared release as:

**W0 — Freeze baseline**

- dependency graph version
- semantic schema SHA
- migration head
- Edge Function version/SHA inventory
- cron inventory
- changed-resource manifest

**W1 — Compatible providers**

Deploy provider changes that preserve old consumer behavior.

**W2 — Provider certification**

Verify provider health and compatibility with current consumers.

**W3 — Consumers**

Deploy affected consumers in dependency order.

**W4 — Full compatibility matrix**

Every affected component must pass.

**W5 — Contract cleanup**

Breaking releases may remove deprecated contracts only after every affected consumer has passed.

**W6 — Certificate**

Issue an immutable certificate tied to the exact graph, schema, migration, Edge and cron baselines.

## Certificate invalidation

A certificate becomes stale if an in-scope release changes any of:

- semantic schema SHA;
- migration head;
- affected Edge Function version/SHA;
- affected cron inventory;
- dependency graph version.

A failed or missing required consumer test also blocks certification.

This is the control that would have prevented the P25/Gomoku overlap.

## Quiet window

Cross-app certification uses a default **60-minute shared-change quiet window**.

The quiet window applies to:

- shared DB migrations;
- affected Edge Functions;
- affected cron jobs;
- Auth/Account/shared identity contracts.

A frontend-only change outside the affected graph does not need to restart the shared-platform window.

## Direct breaking cutovers

A direct breaking provider cutover is exceptional and is blocked unless:

- a maintenance window is explicitly declared;
- every affected consumer is included;
- every consumer candidate is certified against the new provider;
- rollback or forward-fix exists;
- the release-epoch baseline is frozen.

## P29 tools

`scripts/p29-impact-analysis.py`

Takes a change manifest and returns:

- changed components;
- direct/transitive affected components;
- required certification scopes;
- topologically ordered release waves;
- whether the release epoch was invalidated.

`scripts/p29-certify-release.py`

Rejects certification when:

- an affected component is missing;
- an affected component failed;
- a required scope failed;
- graph versions differ;
- schema/migration/Edge/cron baselines changed.

## Activation

P29 remains `staged_pending_p28`.

Production release behavior is not changed by this branch. P29 becomes active only after P28 is certified and the current interrupted P25 sequence has been rebaselined and successfully completed.
