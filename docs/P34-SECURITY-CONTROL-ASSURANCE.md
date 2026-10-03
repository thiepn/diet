# P34 — Security Control Mapping, Continuous Assurance & External Audit Readiness

P34 is **active by explicit operator override** as an engineering phase.

It converts the release-governance, policy and provenance stack into an internal security-control assurance program.

It is **not an external certification** and does not claim SOC 2, ISO 27001, HIPAA, GDPR, or any other external compliance status.

## Framework basis

The authoritative objects are THIEPN's own control IDs.

P34 uses two internal communication/readiness crosswalks:

- **NIST CSF 2.0** at the Function level: GOVERN, IDENTIFY, PROTECT, DETECT, RESPOND, RECOVER.
- **AICPA Trust Services Criteria** at the high-level domain level: Security, Availability, Processing Integrity, Confidentiality, Privacy.

These mappings are internal readiness aids only.

They are not auditor-approved mappings to individual criteria or subcriteria, and they do not prove that a framework requirement has been satisfied.

## Readiness scale

P34 uses a five-step internal maturity/readiness scale:

- **0** — no defined control program
- **1** — control catalog and design baseline
- **2** — implemented controls with point-in-time evidence
- **3** — continuous assurance operating over a defined period
- **4** — external-audit ready, subject to auditor scope and criteria
- **5** — external attestation/certification actually obtained, where applicable

Current readiness level: **2**.

Target readiness level: **4** before describing the ecosystem as ready to enter an external audit.

P34 does not claim level 3 merely because CI tests pass.

## Design vs operating effectiveness

P34 explicitly separates:

1. control design;
2. implementation;
3. point-in-time evidence;
4. operating effectiveness over a defined period;
5. external attestation.

A control cannot be called operationally effective merely because:

- its code exists;
- a unit/contract test passed once;
- the current production snapshot looks healthy;
- a GitHub workflow was green on one date.

Operating effectiveness requires repeated evidence over a defined assessment period.

All 18 controls currently have fresh point-in-time evidence, but all remain marked:

`operatingEffectiveness: insufficient_period`

That is intentional.

## Current production observation

Observed at `2026-10-03T22:06:34.048444Z`:

- project: `ACTIVE_HEALTHY`
- migration: `20261003202015_hub_h12_h13_notes_projection`
- semantic schema fingerprint: `5b7b1caddef09b97f59c85d79d04eabfbe55120fe1754340a7367c1b14d39375`
- Edge Functions: **12**
- `gomoku-room`: **v48**
- Gomoku Edge SHA: `f0493fe400876a8d52f394724d6e44644978d2028b890c912ec283fdc32154cd`
- cron jobs: **14**
- active registered apps: **7**

The migration advanced after the P32 snapshot.

P33 already preserved the older observation as historical evidence and appended the newer Hub migration state.

P34 uses the newer state as the current point-in-time assurance baseline.

## Control catalog

P34 defines **18 internal controls**.

### GOVERN

- **TH-GV-01** — change governance and reviewed release admission
- **TH-GV-02** — resource ownership and lifecycle governance
- **TH-GV-03** — exception and risk-acceptance governance
- **TH-GV-04** — cloud shared-responsibility governance

### IDENTIFY

- **TH-ID-01** — asset and service inventory
- **TH-ID-02** — dependency and blast-radius inventory

### PROTECT

- **TH-PR-01** — identity and authentication safeguards
- **TH-PR-02** — data authorization and row-level access
- **TH-PR-03** — secrets and privileged credential protection
- **TH-PR-04** — privileged database function safety
- **TH-PR-05** — software supply-chain and CI integrity
- **TH-PR-06** — data lifecycle, export and deletion governance

### DETECT

- **TH-DE-01** — security posture monitoring and triage
- **TH-DE-02** — audit logging and change provenance
- **TH-DE-03** — configuration and release drift detection

### RESPOND

- **TH-RS-01** — incident detection, coordination and recovery decision

### RECOVER

- **TH-RC-01** — backup, restore and recovery assurance
- **TH-RC-02** — availability, SLO and capacity resilience

Each control has:

- stable ID;
- owner;
- objective;
- assurance frequency;
- maximum evidence age;
- expected evidence sources;
- deterministic/review test;
- NIST Function mapping;
- high-level Trust Services Criteria domain mapping.

## Current Security Advisor baseline

Observed at `2026-10-03T22:06:31.170Z`.

### 43 WARN — authenticated-callable SECURITY DEFINER functions

Supabase reports **43** functions that signed-in users can execute as `SECURITY DEFINER`.

This is a priority design review.

It is not automatically interpreted as “43 exploitable vulnerabilities.”

Each affected function/class requires evidence for:

- intentional caller role;
- internal authentication/authorization;
- safe privilege/search-path design where applicable;
- no unintended cross-user access;
- remediation or explicit justification;
- advisor retest.

Tracked as **P34-D002**.

### 1 WARN — leaked-password protection disabled

Supabase reports **1** leaked-password-protection configuration warning.

P34 does not enable it automatically.

Any Auth configuration change must pass the normal P32/P30/P31 governance flow.

Tracked as **P34-D001**.

### 71 INFO — RLS enabled with no policy

There are **71** `rls_enabled_no_policy` findings.

This does not automatically mean 71 exposed tables.

Some tables may intentionally be inaccessible to normal API roles.

Each relevant table/class needs classification of:

- exposed schema;
- Data API grants/revokes;
- intended caller;
- service-role/internal-only access;
- whether an RLS policy should exist.

Tracked as **P34-D003**.

## Current Performance Advisor baseline

Observed at `2026-10-03T22:06:31.328Z`.

### 36 WARN — Auth RLS initialization-plan findings

There are **36** `auth_rls_initplan` warnings.

These are tracked for performance/policy review because RLS expression shape can affect query execution cost.

Tracked as **P34-D008**.

### 61 INFO — unindexed foreign keys

There are **61** unindexed-foreign-key INFO findings.

They are not automatically remediated; index value depends on actual workload and relationship usage.

### 123 INFO — unused indexes

There are **123** unused-index INFO findings.

P34 does not remove them automatically.

An index may appear unused because of limited observation history, infrequent workloads, or recently deployed features.

Removal requires longer workload evidence and governed change review.

## Fleet governance coverage

P31 currently records:

- P29 dependency graph nodes: **17**
- observed fleet components: **18**
- dependency-graph coverage: **94.44%**
- registered apps observed: **7**
- registered apps governed: **6**
- registered-app governance coverage: **85.71%**

`semester-os` remains the unmodeled component.

This is now the real governance deficiency.

The old staged P34 draft's “unresolved resource ownership” item is no longer used because P28 had already resolved its known resource ownership set.

Tracked as **P34-D005**.

## P32 enforcement state

P32 remains **warn-only**.

Its policy engine produces real admission decisions, but it does not yet block merges automatically.

That is deliberate because P32 was introduced in warn mode to establish behavior and avoid self-enabling enforcement.

For stronger audit-readiness, the organization still needs a reviewed decision on:

- false-positive/false-negative behavior;
- enforcement scope;
- required-check/branch-protection design;
- exception operations;
- evidence from actual enforce-mode operation.

Tracked as **P34-D007**.

## P33 anchored ledger

P33 provides the evidence-integrity layer used by P34.

P34 binds:

- `platform-p33-audit-ledger.jsonl`
- `platform-p33-ledger-anchor.json`

The ledger/anchor combination detects:

- historical mutation;
- deletion;
- reordering;
- tail truncation;
- hash-chain breakage;
- mismatched ledger/anchor state.

P34 audit-readiness packages include the P33 ledger hash, anchor hash, head hash and entry count.

## Current native audit limitations

P33 established the current provider capability:

- organization plan: Free;
- Platform Audit Logs: not available on the current plan;
- `auth.audit_log_entries`: 0 rows observed;
- `log_connections`: off;
- `pgaudit`: not installed;
- `pg_stat_statements`: installed;
- `pg_cron`: installed.

P34 does not automatically upgrade the plan, enable connection logging or install pgAudit.

Instead it treats the difference between current evidence capability and future audit needs as an explicit assurance gap.

Tracked as **P34-D004**.

## Eight open deficiencies

P34 starts with **8 open deficiencies**.

### High

- **P34-D001** — leaked-password protection disabled
- **P34-D002** — 43 SECURITY DEFINER findings require disposition
- **P34-D005** — Semester OS is outside governed ownership/dependency coverage
- **P34-D006** — operating-effectiveness observation period not yet established

### Medium

- **P34-D003** — 71 RLS/no-policy findings require classification
- **P34-D004** — native audit visibility is incomplete on current plan/config
- **P34-D007** — P32 admission remains warn-only
- **P34-D008** — 36 Auth RLS initialization-plan warnings require disposition

No critical deficiencies are currently recorded by P34.

The register is not a vulnerability count.

It is a governance/assurance register.

## Deficiency lifecycle

Allowed states:

- `open`
- `accepted_temporarily`
- `remediating`
- `ready_for_retest`
- `closed`

### Closure

A deficiency cannot close merely because someone edits the JSON state.

Closure requires:

- closure timestamp;
- retest timestamp;
- evidence hashes;
- successful reassessment.

### Temporary risk acceptance

Temporary acceptance requires:

- approver;
- decision reference;
- expiry;
- maximum lifetime of 90 days.

Critical risk acceptance additionally requires an explicit executive decision reference.

### Historical integrity

Closed deficiencies remain in the register.

They are never silently deleted from history.

## Continuous assurance cadence

### Per change

- TH-GV-01
- TH-GV-03
- TH-ID-02
- TH-PR-03
- TH-PR-05
- TH-PR-06
- TH-DE-02

### Daily

- TH-GV-02
- TH-ID-01
- TH-PR-01
- TH-PR-02
- TH-PR-04
- TH-DE-01
- TH-DE-03

### Weekly

Review:

- deficiency aging;
- exception expiry;
- stale/missing control evidence;
- newly discovered gaps.

### Monthly

Review:

- backup/recovery assurance;
- SLO and capacity posture;
- control-owner attestations.

### Quarterly

Review:

- provider/shared responsibility;
- control catalog;
- framework crosswalk assumptions.

P34 defines these assurance expectations.

It does not create hidden production mutation jobs.

## Evidence freshness

Every control has an explicit maximum evidence age.

P34 does not silently turn stale evidence into a passing control.

The assessor reports:

- fresh controls;
- stale controls;
- not-tested controls;
- design-state counts;
- operating-effectiveness counts.

`status: pass` on the assessor means the assessment package is structurally valid.

It does **not** mean all controls are effective or that THIEPN is audit-ready.

The separate `auditReady` decision remains false while the audit-readiness gates are not satisfied.

## Audit-readiness gate

P34 requires at minimum:

- zero open critical deficiencies;
- zero open high deficiencies;
- zero stale controls;
- zero not-tested controls;
- all control owners attested;
- a defined operating-effectiveness period;
- controls demonstrated effective over that period;
- accurate disclosure of any remaining issues.

Current state fails that gate.

That is why the current readiness level remains **2**.

## Audit-readiness package

`scripts/p34-build-audit-package.py` creates a deterministic internal readiness package.

It binds:

- scope;
- period;
- readiness statement;
- readiness level;
- framework mappings;
- current open deficiency set;
- deterministic assurance assessment;
- P33 ledger;
- P33 reviewed anchor;
- required evidence artifacts;
- artifact SHA-256 and byte size;
- deterministic package root hash.

It fails if:

- the assessment is invalid;
- the P33 ledger and anchor disagree;
- the open-deficiency list does not match the actual register;
- required evidence is missing;
- artifact logical names are duplicated;
- the assessment period is invalid;
- external attestation is asserted;
- unsupported claims such as “SOC 2 certified” or “SOC 2 compliant” are inserted.

The package reduces evidence-collection friction.

It does not replace an external auditor.

## External-audit readiness

Before level 4 can be considered, at minimum:

1. P34-D001 through P34-D008 are remediated, justified or appropriately dispositioned;
2. all high deficiencies are closed;
3. Semester OS is governed;
4. the shared release epoch is stable for the agreed scope;
5. P32 enforcement posture is explicitly decided and evidenced;
6. P33/P34 evidence operates over a defined period;
7. controls have fresh evidence throughout that period;
8. control owners attest;
9. operating effectiveness is supported by repeated evidence rather than point-in-time tests;
10. an audit package accurately states scope, exceptions and unresolved matters.

The auditor ultimately determines external audit scope and evidence sufficiency.

## Automation boundary

P34 may:

- assess controls;
- calculate evidence freshness;
- validate deficiency lifecycle state;
- produce assurance summaries;
- build deterministic readiness packages;
- report gaps.

P34 may not:

- mutate production;
- automatically remediate advisor findings;
- enable password protection;
- revoke function grants;
- add/remove RLS policies;
- alter indexes;
- enable audit logging;
- install pgAudit;
- upgrade the Supabase plan;
- claim external certification.

The P34 workflow is read-only.
