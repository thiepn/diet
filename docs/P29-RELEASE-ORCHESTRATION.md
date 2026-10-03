# P29 — Cross-App Release Orchestration, Dependency Graph & Compatibility Certification

P29 is **active by explicit operator override** as an engineering phase. Earlier time-based phase gates do not block implementation. Future P29 compatibility evidence is still mandatory for releases that use this protocol.

P29 converts P28 ownership into an executable release system: determine what changed, calculate every direct/transitive consumer, produce a provider-before-consumer deployment order, and issue an immutable compatibility receipt only for the exact certified epoch.

## Current graph and epoch

The dependency graph contains **17 nodes** and **47 dependency edges** across platform providers, shared services and registered apps.

Current observed release epoch:

- migration: `20261003094639_arcade_p31_backend_recovery`
- semantic schema fingerprint: `5b7b1caddef09b97f59c85d79d04eabfbe55120fe1754340a7367c1b14d39375`
- Edge Functions: **12**
- Edge inventory SHA-256: `8400fe3f4f203d37e8208a8541c2e6ffc7d49ace98871ecdb80fef1026842da8`
- cron jobs: **13**
- cron inventory SHA-256: `22e21a59a108390b6f669698914e1c958ae4c357be36dce7947b137025e710bc`
- `gomoku-room`: v47
- Micro Arcade recovery export: v1
- unresolved P28 ownership resources: **0**

A later epoch is not rewritten into an old certificate. It requires a fresh baseline.

## Dependency model

Examples of encoded contracts:

- every registered app → Auth
- every registered app → Account lifecycle/identity
- persisted apps/services → Database and Data API
- Edge-backed services → Edge Runtime
- WORDSTRIKE → Leaderboard
- Gomoku → Account grants/connections
- Gomoku → Leaderboard profile contract
- Gomoku → Realtime
- Canvas → Storage

The graph validator cross-checks registered apps, shared services, Edge Function ownership and cron ownership against P28.

## Change classes

### Provider additive

Backward-compatible provider capability. Impact includes the provider and direct consumers.

### Provider breaking

Existing provider contract changes/removals. Impact includes all transitive consumers.

Default pattern: **expand → migrate → contract**.

### Consumer only

Only the consumer is released unless it also changes a shared contract/epoch.

### Data migration without contract change

Owner plus platform-control validation.

### Infrastructure contract

Platform/provider change with transitive consumer certification.

### Operational job

Owner plus platform-control operational validation; cron inventory changes also invalidate the release epoch.

## Release waves

- **W0** — freeze graph, change manifest and release epoch; calculate impact.
- **W1** — backward-compatible providers.
- **W2** — provider health and compatibility with old/current consumers.
- **W3** — affected consumers, always **provider before consumer**.
- **W4** — full compatibility matrix.
- **W5** — deprecated-contract cleanup only with explicit authorization and passed affected-consumer evidence.
- **W6** — immutable Compatibility certificate.

## Graph/content identity

A certificate is not bound only to a human-readable graph version. P29 hashes:

- the dependency graph file bytes;
- the canonical change manifest;
- the schema fingerprint;
- migration head;
- Edge inventory;
- cron inventory.

Changing any bound identity makes old evidence unusable for the new release.

## Impact analysis

`scripts/p29-impact-analysis.py` outputs:

- graph SHA-256;
- change-manifest SHA-256;
- changed components;
- direct/transitive affected components;
- deterministic topological order;
- required scopes;
- release waves;
- whether the release epoch changed;
- whether a quiet window is required.

Unknown components, unknown change classes and dependency cycles fail closed.

## Compatibility certificate

`scripts/p29-certify-release.py` rejects evidence when:

- graph version/hash differs;
- change-manifest hash differs;
- an affected component is missing or failed;
- a required scope is missing or failed;
- schema/migration/Edge/cron baseline changed;
- a required quiet window is too short;
- breaking-contract cleanup is requested without explicit cleanup authorization.

A passing certificate gets a deterministic SHA-256 `certificateId` based on the exact certified evidence.

## Quiet window

Shared/breaking provider certification uses a **60-minute** in-scope quiet window.

It applies when a release changes shared schema, identity contracts, affected Edge contracts, relevant cron inventory, or otherwise makes a breaking/infrastructure provider change.

An unrelated consumer-only release does not restart that window.

## Rollback

Database contract evolution defaults to forward-fix after expand/migrate/contract. P29 never authorizes automatic destructive schema rollback.

Application rollback is only valid while the provider remains compatible with the rolled-back consumer. Any rollback that changes the certified epoch invalidates the old certificate.

## Automation boundary

P29 automation may:

- validate the graph;
- calculate impact;
- generate release waves;
- validate compatibility evidence;
- issue a compatibility artifact.

It **does not promote production** and performs no production mutation.

Promotion remains a separate explicit release action in later phases.
