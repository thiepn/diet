# P32 — Policy-as-Code Enforcement, Automated Change Admission & Fleet Guardrails

P32 is **staged, not active**.

Dependency chain:

**P25 → P26 → P27 → P28 → P29 → P30 → P31 → P32**

P31 answers whether a known release train may advance. P32 moves one step earlier: **should a proposed change be admitted into the governed release system at all?**

## Current mode: shadow

P32 initially runs in **shadow mode**.

A shadow decision is recorded and visible, but it does not replace the existing CI/PR merge rules. This is deliberate: policy engines need a representative false-positive review before they become mandatory admission gates.

Enforcement activation requires a separate reviewed phase/change.

## Live release epoch

P32 rechecked production rather than trusting the older P31 snapshot.

Current observation:

- migration: `20261001162929_gomoku_p12_moderation_review`
- semantic schema SHA: `040813e9bfb672a8a1b8b9ba7af05ce3b729250d43c86110782a1c1dfe167a6b`
- `gomoku-room`: **v38**
- gomoku-room SHA: `6f4a52758d4dcd1b5ebcc2669396c1d65f5c36ba8d6947c724efeefa0b3a0def`
- cron jobs: 10

P31 observed Gomoku P11 / v35. Therefore its release-epoch snapshot is already stale and the shared epoch remains **moving**.

This does not mark production unhealthy. It blocks automatic admission of new stateful/shared changes until the epoch stabilizes.

## Decisions

Every P32 evaluation returns exactly one of:

### `admit`

The change may enter P29/P30/P31 release processing.

**Admit does not mean production approved.**

It means only **entry into the governed release flow**.

### `block`

A hard rule is violated or required evidence is missing.

Examples:

- unknown owner/component;
- unresolved governance resource;
- service-role key in client code;
- missing RLS;
- missing breaking-change consumer coverage;
- stateful shared change during a moving release epoch.

### `escalate`

The change may be legitimate but requires explicit human/platform approval.

Examples:

- new paid resource;
- direct production mutation request;
- destructive recovery/data action;
- modification of the P32 policy engine itself.

The engine cannot grant production approval.

## Admission pipeline

1. Normalize manifest.
2. Validate identity, owner and component.
3. Classify change and risk.
4. Apply security/data guardrails.
5. Apply release-epoch, environment and fleet guardrails.
6. Verify dependency/release-train routing.
7. Validate exceptions.
8. Emit decision, findings and required downstream gates.

Every finding has a stable policy ID.

## Key policy classes

### Ownership and lifecycle

Every changed component must exist in the P31 fleet registry and have a declared owner.

Retired components do not accept new features. Deprecated/archived components only admit lifecycle-compatible maintenance, migration or retirement work.

### Governance

A change touching an unresolved resource such as `public.change_log` is blocked.

P32 does not guess away P28 governance debt.

### Release epoch

Stateful/shared changes block while the shared epoch is moving.

An unrelated consumer-only `app_fast` change may still be admitted when its scopes do not intersect a fleet block.

### Environment

Shared/stateful changes require a healthy isolated Supabase branch/persistent branch.

A branch reporting `MIGRATIONS_FAILED` cannot be treated as a healthy stateful integration environment.

### Cost

Paid resources are never silently created by policy.

Requests such as preview environments, compute upgrades or paid add-ons escalate until explicit current-cost approval exists.

### Production and destructive data

Direct production mutation never automatically admits.

Destructive user-data deletion, destructive restore and irreversible rewrites always escalate to governed human/incident handling.

## Supabase security admission rules

P32 encodes current Supabase-specific hard guardrails.

### Secret/service-role keys

Client/browser code containing a `service_role` or secret key is blocked.

### Authorization metadata

User-editable metadata must not become an authorization source.

### RLS

New tables exposed through the Data API must have RLS before admission.

### SECURITY DEFINER

A new public `SECURITY DEFINER` function is blocked unless its callable roles are explicitly restricted and the privileged authorization model is declared.

### Deprecated auth.role()

New authorization logic using `auth.role()` is blocked by default. This rule is temporarily waivable only through the exception system because legacy migration may require a short compatibility period.

### Supply chain

Production GitHub Actions must remain pinned to immutable commit SHAs.

## Compatibility routing

A breaking provider change must include all P29 transitive consumers.

For example, a breaking Leaderboard provider change must account for the consumers represented in the P29 graph, including Wordstrike and Gomoku.

Shared/stateful changes cannot claim the `app_fast` train type.

## Exceptions

Exceptions are not free-form comments.

A valid exception requires:

- exception ID;
- exact policy IDs;
- owner;
- independent approver;
- reason;
- issue/reference;
- creation time;
- expiration;
- explicit scopes.

Rules:

- maximum lifetime: **7 days / 168 hours**;
- no wildcard policy IDs;
- no wildcard scopes;
- no self-approval;
- expired exceptions are ignored and reported;
- an exception only applies to matching change scopes.

### Non-waivable policies

Core controls cannot be waived, including:

- secret/service-role exposure;
- user-metadata authorization;
- missing RLS on newly exposed tables;
- destructive data actions;
- direct production mutation;
- policy-engine self-approval.

A syntactically valid exception that attempts to waive one of these is itself rejected.

## Policy self-protection

Changes to the P32 policy bundle, admission engine or admission workflow always **escalate**.

The policy engine cannot edit itself and then return `admit` for that edit.

Independent platform review is required.

## Shadow workflow

`.github/workflows/p32-change-admission-shadow.yml` runs admission examples/evidence without using `--fail-on-block`.

This makes P32 observable before enforcement.

The staged rollout is:

`shadow → warn → enforce → production`

Moving from one mode to another is a reviewed policy change, never an automatic self-promotion.

## Relationship to P29–P31

P32 is an **admission gate**, not a replacement for later gates.

An admitted change may still require:

- P29 impact analysis and compatibility certificate;
- P30 immutable candidate/environment promotion;
- P31 scoped `can-release` decision;
- explicit production approval.

P32 therefore prevents bad changes from entering the train while preserving defense in depth downstream.

## Activation

P32 remains `staged_pending_p31`.

It cannot enforce merges until P31 is certified, the release epoch is stable, shadow-mode false positives have been reviewed, and all non-waivable negative tests remain green.
