# P35 — Control Remediation, Operating-Effectiveness Evidence Period & Audit Dry-Run Certification

P35 is **staged, not active**.

Dependency chain:

**P25 → P26 → P27 → P28 → P29 → P30 → P31 → P32 → P33 → P34 → P35**

P35 moves P34 from point-in-time assurance toward actual remediation and operating-effectiveness evidence.

It still does not claim an external attestation.

## Latest live state

P35 rechecked production:

- project: `ACTIVE_HEALTHY`
- migration: `20261002062342_gomoku_p15_operations_rollouts_drills`
- semantic schema SHA: `07a1da3fab56e7e3d3efe28775773eb5a295212bf3f965c421d46314fd61b0e4`
- cron jobs: 11
- release epoch: **moving**

The shared platform changed again after P34. Therefore the P35 operating-effectiveness period cannot start yet.

## Real remediation triage

P35 inspected the database instead of treating Security Advisor counts as vulnerabilities by definition.

### 53 RLS-enabled/no-policy tables

Current result:

- 53 tables;
- 0 have direct DML grants to `anon`;
- 0 have direct DML grants to `authenticated`.

This is consistent with an intentional service-only / deny-by-default access model.

Current Supabase guidance states that RLS enabled without a policy means Data API row access is denied. An explicit rejection policy can make that intent clearer.

P35 therefore does **not** add 53 permissive policies merely to remove an INFO advisor finding.

Before P34-D003 can close, the table classes and intended callers must be documented and future grant regressions must be tested.

### 39 SECURITY DEFINER warnings

The 39/39 currently flagged authenticated-callable privileged RPCs share a coherent pattern:

- **0/39** executable by `anon`;
- **39/39** reference `auth.uid()`;
- **39/39** have a controlled empty `search_path`;
- **21/39** also reference `auth.jwt()`;
- **33/39** contain explicit rejection paths.

This materially narrows the concern: the design appears to be intentional authenticated privileged RPCs rather than accidentally public functions.

It does not by itself prove cross-user authorization correctness. P34-D002 remains open until the RPCs are reviewed by function/class, authorization is demonstrated, and the advisor is retested.

### Leaked-password protection

Supabase currently documents leaked-password protection as a **Pro Plan or above** feature.

The current organization is Free.

P35 therefore cannot close P34-D001 by silently flipping a setting. The choices are:

1. approve the plan/cost change and enable it through the governed production release process; or
2. temporarily accept/document the residual risk with compensating Auth controls.

No billing or Auth change is made by P35 staging.

## Other remediation items

P35 carries all seven P34 deficiencies:

- P34-D001 — Auth/cost decision required;
- P34-D002 — privileged-RPC review ready;
- P34-D003 — service-only table classification ready;
- P34-D004 — native audit visibility decision required;
- P34-D005 — resource ownership resolution required;
- P34-D006 — blocked by moving release epoch;
- P34-D007 — stateful preview/cost decision required.

No deficiency is automatically closed.

## Operating-effectiveness evidence period

P35 defines two time horizons.

### 30-day internal dry-run

Minimum internal evidence period: **30-day** calendar window.

Purpose:

- prove evidence collection works continuously;
- exercise control-owner and deficiency workflows;
- detect false assumptions before auditor engagement;
- prove failed controls are linked to incidents/deficiencies rather than hidden.

### 90-day readiness target

Default planning target before external-audit readiness: **90-day** evidence period.

This is a planning target, not an auditor requirement. The actual scope, period and sample sizes are agreed with the eventual auditor/framework.

## Start gate

The evidence period does not start automatically.

It requires:

- release epoch stable for at least 60 minutes;
- replacement P25 burn-in certified;
- P32 at least in warn/enforce mode;
- P33 canonical evidence process active;
- no critical open deficiency;
- high deficiencies remediated or formally dispositioned;
- control catalog frozen for the period;
- evidence-collection dry-run passing.

Until those gates pass, P35 state remains:

`not_started_blocked_by_moving_release_epoch`

## Evidence coverage

### Per change

Every production-impacting change during the period must have the required P29–P33 control evidence.

Coverage requirement: **100%**.

### Daily

Daily assurance controls target:

- at least 95% successful evidence days;
- no more than one consecutive missed day.

### Weekly

Every week touched by the evidence period must contain:

- deficiency-aging review;
- exception-aging review;
- evidence-freshness review.

### Monthly

At least one monthly cycle must include:

- availability/SLO/capacity review;
- control-owner attestation;
- readiness summary.

### Quarterly

Quarterly evidence is not required to pass the 30-day internal dry-run, but is required for the longer external-readiness evidence model.

## Failure handling

A failed control test is not automatically a failed evidence period.

It must be linked to a deficiency or incident and resolved/dispositioned through the governed process.

An **unexplained** failed control test causes the evidence evaluator to fail.

## Audit dry-run

P35's audit dry-run simulates an evidence request before an external auditor is involved.

Required areas include:

- system boundary;
- control catalog;
- owner matrix;
- risk/deficiency register;
- change population and samples;
- access-control samples;
- Security Advisor dispositions;
- incident or drill sample;
- backup/restore evidence;
- exceptions population;
- vendor/shared-responsibility evidence;
- operating-effectiveness summary;
- P33 provenance index.

The dry-run fails if:

- the evidence period is shorter than 30 days;
- a required section/artifact is missing;
- operating-effectiveness evaluation fails;
- a closed deficiency lacks retest evidence;
- an unexplained control failure exists;
- unsupported language claims external certification.

A P35 dry-run pass means only that the simulated evidence package is internally self-consistent and sample-complete.

It is **not an external attestation**.

## Production boundary

P35 does not automatically:

- enable leaked-password protection;
- change Supabase plans;
- alter RLS policies;
- revoke/grant function privileges;
- create preview environments;
- change logging;
- modify production schema.

Any actual remediation must enter P32 admission, P29 compatibility where relevant, P30 promotion, and P31 release coordination.

## Activation

P35 remains `staged_pending_p34`.

The actual operating-effectiveness clock cannot begin until the shared release epoch stops moving and the replacement P25 burn-in is complete.
