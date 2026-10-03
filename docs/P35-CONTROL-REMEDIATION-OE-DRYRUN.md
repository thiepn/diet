# P35 — Control Remediation, Operating-Effectiveness Evidence Period & Audit Dry-Run

P35 is **active by explicit operator override** as an engineering phase.

It moves P34 from point-in-time assurance toward remediation work, a future operating-effectiveness evidence period, and an internal audit dry-run.

It is **not an external attestation** and does not claim SOC 2, ISO 27001, HIPAA, GDPR, or any other external certification/compliance status.

## Current production state

P35 rechecked the live shared Supabase platform at `2026-10-03T22:55:16.598746Z`.

Current state:

- project: `ACTIVE_HEALTHY`
- migration: `20261003221217_hub_h15_tms60_projection`
- semantic schema fingerprint: `5b7b1caddef09b97f59c85d79d04eabfbe55120fe1754340a7367c1b14d39375`
- cron jobs: **14**
- active registered apps: **7**

P34's point-in-time baseline used migration `20261003202015_hub_h12_h13_notes_projection`.

Production therefore moved after the P34 snapshot.

The real P35 operating-effectiveness period is **not started**.

P35 does not backfill the intervening time and call it operating evidence.

## Security Advisor drift since P34

P34 recorded:

- 43 authenticated-callable `SECURITY DEFINER` warnings;
- 71 RLS-enabled/no-policy INFO findings;
- 1 leaked-password warning.

P35 now observes:

- **47** authenticated-callable `SECURITY DEFINER` warnings;
- **73** RLS-enabled/no-policy INFO findings;
- **1** leaked-password warning.

That is drift of:

- +4 privileged RPC warnings;
- +2 RLS/no-policy findings;
- no change to the leaked-password warning.

P35 records this drift rather than rewriting the P34 historical snapshot.

## Performance Advisor drift

P34 recorded **36** `auth_rls_initplan` warnings.

P35 now observes **38**.

The other current Performance Advisor counts remain:

- 61 unindexed-foreign-key INFO findings;
- 123 unused-index INFO findings.

P35 does not automatically rewrite RLS policies or remove indexes just to lower advisor counts.

## RLS/no-policy remediation triage

P35 reclassified the exact **73** tables in the current Security Advisor finding population.

For that exact advisor-scoped set:

- **0/73** have effective SELECT/INSERT/UPDATE/DELETE privileges for `anon`;
- **0/73** have effective SELECT/INSERT/UPDATE/DELETE privileges for `authenticated`.

This is important because Data API object privileges and RLS are separate controls.

The current advisor-scoped tables are therefore not directly client-DML reachable by those two roles.

That does **not** automatically close P34-D003.

Before closure, P35 still requires:

- owner/table-class classification;
- intended caller model;
- confirmation that service-only tables should remain inaccessible;
- evidence that future grant changes cannot accidentally expose them;
- Security Advisor and privilege retest.

P35 does not add permissive RLS policies merely to make the INFO count disappear.

## Privileged RPC remediation triage

The current advisor population contains **47** authenticated-callable `SECURITY DEFINER` functions.

Static triage shows:

- **0/47** executable by `anon`;
- **47/47** executable by `authenticated`;
- **47/47** reference `auth.uid()`;
- **47/47** have a controlled empty `search_path`;
- **28/47** also reference `auth.jwt()`;
- **41/47** have an obvious static rejection signal such as a raised exception or null-return rejection path.

The remaining **six functions** without that simple static rejection signal are:

- `claim_notes_sync_access(p_code text)`
- `disable_notes_sync_access()`
- `has_notes_sync_access()`
- `list_notes_auth_sessions()`
- `list_thiepn_account_sessions()`
- `notes_auth_identity_delete_status()`

These static properties materially narrow the risk.

They do not prove that all 47 functions correctly enforce subject binding, object ownership, cross-user denial and least privilege.

P34-D002 therefore remains open until function/class review and retest are complete.

## Leaked-password protection

Current Supabase Auth documentation states:

> Leaked password protection is available on the **Pro Plan and above**.

The current organization remains Free.

P35 therefore does not silently:

- upgrade the Supabase plan;
- accept a cost;
- enable the Auth setting;
- claim the risk is accepted.

P34-D001 remains a security/cost decision.

The legitimate paths are:

1. approve current cost, upgrade/enable through the governed change process, and retest; or
2. explicitly record bounded risk treatment and compensating controls through the normal exception/risk process.

The operator override for phase progression does not authorize either choice.

## Current remediation register

P35 carries all **8** P34 deficiencies.

### P34-D001 — high

State: `decision_required`

Leaked-password protection needs an explicit cost/security decision.

### P34-D002 — high

State: `authorization_review_ready`

Review all 47 privileged RPCs, with priority attention to the six functions lacking a simple static rejection signal.

### P34-D003 — medium

State: `classification_review_ready`

Classify the 73 advisor-scoped RLS/no-policy tables by intended caller and preserve zero effective client DML for service-only tables.

### P34-D004 — medium

State: `evidence_capability_decision_required`

Define the audit-log evidence requirement before considering plan upgrades, connection logging or pgAudit.

### P34-D005 — high

State: `governance_onboarding_required`

`semester-os` still needs ownership/lifecycle registration and P29 dependency-graph onboarding before P31 fleet coverage can reach 100%.

### P34-D006 — high

State: `evidence_period_not_started`

The operating-effectiveness clock cannot be backfilled. It begins only after the explicit P35 start gate passes.

### P34-D007 — medium

State: `enforcement_decision_required`

P32 remains warn-only.

P35 does not silently promote P32 to enforce mode. That requires a separate reviewed policy/enforcement decision using actual warn-mode evidence.

### P34-D008 — medium

State: `performance_review_ready`

The current **38** `auth_rls_initplan` warnings require policy-by-policy performance disposition and retest where remediation is justified.

No P35 deficiency is automatically closed.

## Operating-effectiveness evidence period

P35 defines two planning horizons.

### 30-calendar-day internal period

The minimum internal operating-effectiveness/dry-run period is **30-calendar-day**.

The clock starts only after an explicit start authorization.

There is **no backfill**.

Evidence created before that authorization cannot be relabeled later as operating-period evidence.

### 90-day external-readiness planning target

P35 retains a **90-day** planning target for a more substantial readiness history.

That is not an auditor requirement.

The actual framework criteria, period, sampling and evidence expectations must be agreed with the eventual external auditor.

## Start gate

A real period requires all of the following:

- at least 60 minutes of scoped release-epoch stability;
- zero open critical deficiencies;
- P34-D001, P34-D002 and P34-D005 closed, remediating, ready for retest, or explicitly/temporarily accepted through the governed process;
- P32 at least in warn mode;
- P33 anchored ledger verification;
- frozen P34 control catalog/snapshot identities;
- passing evidence-collector contract;
- exact artifact hashes;
- an explicit independent start authorization.

Current start decision: **blocked**.

Reasons include:

- production advanced after the P34 snapshot to `hub_h15_tms60_projection`;
- P34-D001 is still `decision_required`;
- P34-D002 is still `authorization_review_ready`;
- P34-D005 is still `governance_onboarding_required`;
- no P35 start authorization exists.

The start-gate engine can issue a deterministic authorization ID only when all gates pass.

It never starts the period clock by itself.

## Synthetic vs real evidence

P35 has a hard distinction between:

- `synthetic_test`
- `production_evidence`

A simulation period accepts only synthetic evidence.

A real operating period accepts only production evidence.

Therefore a CI-generated 30-day test fixture cannot be presented as 30 days of real operating history.

The evaluator explicitly rejects synthetic evidence in `operating` mode.

This is one of P35's main anti-fake-certification controls.

## Per-change evidence

Every production-impacting change in a real period must have 100% coverage for the configured per-change control set.

The declared change population is explicit.

A missing control sample for a declared change fails the period evaluation.

## Daily evidence

Daily controls require:

- at least **95%** successful days;
- no more than **one consecutive missed day**.

A two-day consecutive evidence gap fails the period evaluation.

## Weekly evidence

Every ISO week touched by the period requires:

- open-deficiency aging review;
- exception aging review;
- evidence-freshness review.

## Monthly evidence

At least one monthly cycle requires:

- backup/restore assurance;
- SLO/capacity assurance;
- platform control-owner attestation;
- account control-owner attestation;
- readiness summary.

## Incident population

Every incident during the period must be covered.

If the incident population is zero, P35 requires a documented incident-response drill.

A zero-event period cannot simply omit incident evidence.

## Restore population

Every evidence period needs at least one:

- restore/recovery sample; or
- approved recovery drill.

## Exception population

Every exception in the period must be reconciled.

If there are zero exceptions, P35 requires an explicit zero-population evidence record.

## Failed controls

Failed evidence is never silently dropped.

Every failure requires:

- a linked deficiency/incident/issue;
- a resolution reference;
- a subsequent passing retest for the same control/test before the period can pass.

An unexplained failure fails the evaluation.

## Period reset conditions

The period can require restart/rebaseline when evidence comparability is broken by:

- material control redesign;
- critical control/security failure;
- unexplained evidence loss/corruption;
- evidence-tooling changes that invalidate earlier samples;
- control-catalog changes affecting sampled objectives without an approved period amendment.

## Internal audit dry-run

P35 implements an internal dry-run engine.

Required sections include:

- scope and system boundary;
- control catalog;
- owner matrix;
- risk/deficiency register;
- change population and samples;
- access-control samples;
- Security Advisor dispositions;
- incident/drill evidence;
- backup/restore evidence;
- exception population;
- vendor/shared-responsibility evidence;
- operating-effectiveness summary;
- P33 provenance index.

The engine also binds the P33 ledger and reviewed anchor.

## Simulation-only certificate

CI can create a complete 30-day synthetic evidence fixture to prove the evaluator works.

A successful simulation may receive a deterministic **simulation-only** dry-run certificate ID.

That means only:

- the evidence machinery is internally consistent;
- required populations and sections reconcile;
- negative-path protections work.

It does **not** mean:

- 30 days elapsed in production;
- real operating effectiveness was demonstrated;
- P34 reached readiness level 3 or 4;
- an external auditor approved anything.

For simulation output:

- `operatingEffectivenessProven: false`
- `auditReady: false`
- `externalAttestation: false`

## Real operating dry-run

After a genuinely authorized and completed operating period, the same dry-run engine can consume the real operating-period result.

It rejects operating-mode dry runs backed by simulation evidence.

Even a successful real internal dry run is still not an external attestation.

## Deficiency integrity

P35 does not allow a deficiency to appear closed merely because its JSON state changed.

A closed deficiency still needs:

- closure timestamp;
- retest timestamp;
- evidence hashes;
- P34/P35 reassessment.

P35 preserves historical deficiency records.

## Production boundary

P35 does not automatically:

- mutate production;
- modify Auth configuration;
- upgrade Supabase;
- change RLS policies or grants;
- revoke/alter privileged RPCs;
- alter indexes;
- change logging;
- enable pgAudit;
- accept risk;
- close deficiencies;
- start/backdate an operating-effectiveness period;
- promote P32 enforcement.

Actual remediation remains subject to the existing P29–P33 governance chain.

## Current phase result

P35 engineering controls can be implemented and merged now.

The real operating-effectiveness period remains **not started** until the explicit start gate passes.

That separation is intentional: engineering phase completion is not evidence-period completion.
