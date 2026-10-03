# P34 — Security Control Mapping, Continuous Assurance & External Audit Readiness

P34 is **staged, not active**.

Dependency chain:

**P25 → P26 → P27 → P28 → P29 → P30 → P31 → P32 → P33 → P34**

P34 converts the evidence and release-governance work into an internal security-control program that can later support an external audit.

It is **not an external certification** and does not claim SOC 2, ISO 27001, HIPAA, GDPR, or any other external compliance status.

## Framework mapping

The authoritative objects are THIEPN's own control IDs.

P34 maps those controls for communication/readiness to:

- **NIST CSF 2.0** — GOVERN, IDENTIFY, PROTECT, DETECT, RESPOND, RECOVER;
- **SOC 2 readiness domains** — Security, Availability, Processing Integrity, Confidentiality, Privacy.

These are internal crosswalks only. They are not auditor-approved mappings and do not prove that a particular Trust Services Criterion has been satisfied.

## Current readiness

Current readiness level: **2 / controls implemented with point-in-time evidence**.

Target before engaging an external audit as “audit ready”: **4 / externally audit-ready subject to auditor scope**.

P34 deliberately separates:

- control design;
- implementation;
- point-in-time test evidence;
- operating effectiveness over time;
- external attestation.

A passing unit test does not prove operating effectiveness across an audit period.

## Latest production observation

P34 rechecked production:

- project: `ACTIVE_HEALTHY`
- migration: `20261001202408_gomoku_p14_audit_sequence_hardening`
- semantic schema SHA: `6eeac4c344629484c38e70574a7a4ee0c493118282e9c065e2476643c66d2862`
- `gomoku-room`: **v40**
- Edge SHA: `f04a4796ac94c668bbec2b2a58917bb570ebb64d8038b19bf51534da91da3eee`
- cron jobs: 11

The release epoch is still moving. P25 still cannot provide the replacement stable burn-in period.

## Control catalog

P34 defines **18 internal controls** covering:

- change governance;
- ownership/lifecycle;
- exceptions;
- provider/shared responsibility;
- inventory;
- dependency/blast radius;
- authentication;
- RLS/data authorization;
- secrets;
- privileged functions;
- supply-chain/CI integrity;
- data lifecycle;
- security monitoring;
- audit/provenance;
- drift detection;
- incident response;
- backup/recovery;
- availability/SLO/capacity.

Each control has:

- stable ID;
- owner;
- objective;
- NIST function mapping;
- high-level SOC 2 readiness-domain mapping;
- expected frequency;
- evidence sources;
- deterministic or review test.

## Security Advisor baseline

Current Security Advisor findings:

### 39 WARN — authenticated-callable SECURITY DEFINER functions

This is a **priority design review**, not an automatic declaration that 39 vulnerabilities exist.

Authenticated execution can be intentional for user-facing RPCs, but each function/class must demonstrate:

- intentional callable role;
- internal authentication/authorization;
- safe search path/privilege model where applicable;
- no unintended cross-user access;
- a remediation or documented justification;
- post-change/review retest.

### 1 WARN — Leaked password protection disabled

This is tracked as an **open configuration gap** under `TH-PR-01`.

P34 does not enable it automatically. A production Auth configuration change must go through P32/P30/P31 governance.

### 50 INFO — RLS enabled with no policy

These findings require classification.

A table with RLS and no policy can be intentionally inaccessible to normal API roles, so the finding alone does not prove an exposure. For each relevant table/class, P34 needs evidence of:

- Data API exposure;
- grants;
- intended caller;
- service-role/internal access design;
- policy requirements, if any.

## Assurance deficiencies

Seven initial deficiencies are tracked:

- **P34-D001** — leaked-password protection disabled;
- **P34-D002** — 39 SECURITY DEFINER warnings need disposition;
- **P34-D003** — 50 RLS/no-policy INFO findings need classification;
- **P34-D004** — incomplete native audit visibility on current plan/config;
- **P34-D005** — unresolved resource ownership;
- **P34-D006** — no stable operating-effectiveness/burn-in window yet;
- **P34-D007** — no stateful non-production integration environment.

Deficiencies are never silently deleted.

Closure requires evidence and retest.

Temporary risk acceptance requires an expiry and remains visible in history.

## Continuous assurance

Target cadence:

- **per change** — release, provenance, supply-chain, dependency and data-lifecycle controls;
- **daily** — inventory, authentication/RLS/privileged-function posture, advisor state and drift;
- **weekly** — open deficiency aging, exceptions and evidence freshness;
- **monthly** — SLO/capacity and control-owner attestation;
- **quarterly** — provider/shared-responsibility and control-catalog review.

P34 is currently staged, so these cadences are policy targets, not active background jobs.

## Evidence freshness

A control cannot pass on stale or missing evidence.

P34 distinguishes expected evidence ages for daily, weekly, monthly and quarterly controls. When required evidence is missing, the state is `not_tested`, not “assumed healthy.”

A regression reopens the control/deficiency.

## Audit package

`scripts/p34-build-audit-package.py` produces a deterministic readiness package containing:

- scope;
- assessment period;
- readiness statement;
- framework mappings;
- open deficiency IDs;
- hashes/sizes for required evidence artifacts;
- deterministic root hash.

It rejects unsupported claims such as “SOC 2 compliant” or “certified” during P34 staging.

The package is meant to reduce evidence-collection friction for an eventual auditor, not replace the auditor.

## Shared responsibility

Supabase operates and secures substantial portions of the hosted platform, but THIEPN remains responsible for its own access management, application architecture, schema/data controls, secrets, policies and use of platform security controls.

Provider SOC 2 status does not automatically transfer to THIEPN.

## External audit readiness

Before P34 can call the ecosystem audit-ready, at minimum:

1. security-advisor WARN findings are remediated or explicitly justified and retested;
2. security-relevant INFO findings are classified;
3. ownership blockers are resolved;
4. the release epoch stabilizes;
5. replacement P25 burn-in completes;
6. P32 and P33 operate over a defined period rather than only point-in-time staging;
7. evidence freshness and deficiency aging are continuously measured;
8. operating effectiveness is observed over an agreed period;
9. the final audit package states scope, period and unresolved issues accurately.

## Activation

P34 remains `staged_pending_p33`.

No production setting, RLS policy, function grant, password policy, logging configuration, plan, or audit feature is changed by this phase.
