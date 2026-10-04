# P36 — Remediation Execution, Stable-Epoch Freeze & Operating-Effectiveness Activation

P36 is **active by explicit operator override** as an engineering phase.

It executes the repository/governance remediations that are safe and evidence-ready now, establishes a fresh stable release epoch, and implements the real operating-effectiveness activation gate.

It does **not** backdate operating history, accept unresolved risk automatically, mutate production merely to clear findings, or claim external certification.

## Current live epoch

Observed at `2026-10-04T12:55:17.146329Z`:

- project: `ACTIVE_HEALTHY`
- migration: `20261003221217_hub_h15_tms60_projection`
- semantic schema SHA: `5b7b1caddef09b97f59c85d79d04eabfbe55120fe1754340a7367c1b14d39375`
- Edge Functions: **12**
- `gomoku-room`: **v48**
- cron jobs: **14/14 active**
- cron executions in the observed 24h: **5,791**
- cron failures: **0**
- blocking replication slots: **0**
- P18 integrity: `clean`
- P20 schema drift: `false`
- P21 readiness: `pass`
- P22 maintenance: `pass`

Security Advisor remains:

- **47** authenticated-callable `SECURITY DEFINER` WARNs
- **73** RLS/no-policy INFO findings
- **1** leaked-password-protection WARN

Performance Advisor remains:

- **38** `auth_rls_initplan` WARNs
- 61 unindexed-FK INFO findings
- 123 unused-index INFO findings

## Generation 3 is historical

The repository still carried the P25 generation-3 freeze:

`20261002172133_gomoku_p17_certification_health_isolation`

Production subsequently advanced through:

- Gomoku P18/P20 changes
- Micro Arcade P31 recovery
- Hub H12/H13 Notes projection
- Hub H15/TMS60 projection

Generation 3 therefore cannot be used to activate operating effectiveness.

P36 preserves it as historical evidence and establishes **generation 4**.

## Generation 4 stable epoch

Generation 4 freezes:

- migration: `20261003221217_hub_h15_tms60_projection`
- schema SHA: `5b7b1caddef09b97f59c85d79d04eabfbe55120fe1754340a7367c1b14d39375`
- Edge functions: 12
- Edge inventory SHA: `4d9c066197de1f456665dfa4b328917deaeab6b427860bfd9e23786e14e311bd`
- Gomoku: v48 / `f0493fe400876a8d52f394724d6e44644978d2028b890c912ec283fdc32154cd`
- cron jobs: 14
- cron inventory SHA: `652724f6d80db7f2382637925f3eba6205d114b02204ed68fdf115e5bfc20692`

At freeze:

- migration quiet: **883 minutes**
- latest Edge change quiet: **1536 minutes**
- required quiet window: 60 minutes

The freeze itself is valid.

It is **not certified** yet.

Generation 4 starts at:

`2026-10-04T12:55:17.146329Z`

Earliest 24-hour certification:

`2026-10-05T12:55:17.146329Z`

## Generation-4 certification requirements

P36 requires all of the following before the freeze can support OE activation:

- minimum 24 hours elapsed
- at least 12 successful healthy samples
- samples spanning all **six 4-hour** buckets
- terminal healthy sample at/after the 24-hour boundary
- exact migration/schema/Edge/cron identity unchanged
- post-final-shared-change backup verified
- final P18 clean
- final P20 drift false
- final P21 pass
- final P22 pass
- zero unexplained cron failures
- zero blocking replication slots
- Security/Performance Advisor retest

## Post-final-shared-change backup

A qualifying generation-4 **post-final-shared-change backup** is not currently verified.

P36 deliberately does not reuse the generation-3 backup just because it was previously successful.

The backup gate therefore remains false.

This is one reason OE is **not started**.

## Semester OS remediation

P34-D005 was the real governance-coverage gap.

Before P36:

- P29 governed nodes: 17
- observed fleet components: 18
- dependency coverage: 94.44%
- registered apps governed: 6/7
- `semester-os`: observed but unmodeled

P36 executes the safe Git/governance remediation.

### P28

`semester-os` is now a registered active app with owner `thiepn`.

### P29

`semester-os` is the 18th dependency node.

It has hard dependencies on:

- Auth
- Account
- Data API
- Database

P29 now has:

- **18/18** governed observed components
- 51 dependency edges

### P31

`semester-os` becomes:

- owner: `thiepn`
- criticality: tier1
- lifecycle: active
- governance: governed
- scope: `app:semester-os`

Coverage is now:

- dependency graph: **100%**
- registered apps: **7/7**
- registered-app governance: **100%**

The former `p29-graph-missing-semester-os` drift is removed.

### P32

P32 registry bindings are refreshed to the new P29/P31 versions.

P32 remains in **warn mode**.

P36 does not turn governance remediation into an implicit enforcement-mode promotion.

## P34-D005

Result: **closed by P36 remediation execution**.

The original P34 deficiency register remains historical and unchanged.

P36 is the closure event.

Closure evidence is the reconciled P28/P29/P31/P32 state.

## P34-D002

Current state: `remediating`.

Current privileged-RPC retest:

- 47 functions
- 0 anon-executable
- 47 authenticated-executable
- 47 reference `auth.uid()`
- 47 have controlled empty search paths
- 41 have a simple static rejection signal
- six remain priority manual/deeper review targets

This is strong remediation evidence, but not enough for automatic closure.

Cross-user denial and function/class authorization evidence are still required.

## P34-D003

Current state: `ready_for_retest`.

For all **73** current RLS/no-policy tables:

- effective anon DML privilege: 0
- effective authenticated DML privilege: 0

This supports a deny-by-default/service-only interpretation.

Formal intended-caller classification plus hashed retest evidence are still required before closure.

## P34-D001

Current state: `decision_required`.

Leaked-password protection remains disabled and current Supabase documentation places that feature on Pro Plan and above.

P36 does not:

- buy/upgrade the plan
- silently accept the risk
- claim the control is remediated

D001 therefore remains a high-severity activation blocker.

The phase-progression override does not waive this.

## P34-D004

Current state: `evidence_capability_decision_required`.

P33 remains the canonical internal provenance/audit trail.

P36 does not enable extra provider-native logging, install pgAudit or upgrade the plan without a separate governed decision.

## P34-D006

Current state: `remediating`.

Generation 4 is the active stable-epoch remediation.

D006 is not closed just because the freeze exists.

The fresh burn-in and OE activation gates still have to complete.

## P34-D007

Current state: `enforcement_decision_required`.

P32 remains warn-only.

P36 reconciles registry facts but does not silently promote P32 to enforce mode.

## P34-D008

Current state: `performance_review_ready`.

The **38** Auth/RLS initialization-plan warnings remain review targets.

No speculative RLS rewrite is applied during the freeze.

## Release registry reconciliation

P36 also reconciles the P31 release registry through merged P35.

The registry now records merged P31–P35 commits rather than claiming P30 is still the latest merged governance phase.

This prevents later policy tooling from binding to obsolete governance lineage.

## OE activation state

Current state:

`armed_waiting_generation4_and_high_deficiency_gate`

Active: **false**

The period clock is **not started**.

## OE activation requirements

The P36 activation evaluator requires:

1. current P25 generation is exactly generation 4;
2. live epoch exactly equals the frozen generation-4 epoch;
3. 24-hour minimum reached;
4. at least 12 healthy samples;
5. all six 4-hour coverage buckets represented;
6. terminal healthy sample exists;
7. post-final-shared-change backup verified;
8. P18/P20/P21/P22/cron/replication health passes;
9. P34-D001 is formally dispositioned;
10. P34-D002 is closed/remediating/ready-for-retest/temporarily accepted;
11. P34-D005 is closed;
12. P32 is at least warn;
13. P33 canonical evidence is active;
14. P34 control catalog is frozen;
15. P35 evidence-collection dry-run passes;
16. no critical deficiency is open;
17. exact P33/P34 artifact hashes match;
18. an explicit independent activation authorization exists.

The evaluator fails closed.

## Exact evidence binding

Activation context binds the actual:

- P33 head hash
- P33 ledger-anchor file SHA-256
- P34 control-catalog SHA-256
- P34 assurance-snapshot SHA-256

Supplying arbitrary 64-character strings does not satisfy the gate.

## Independent authorization

The requester and authorizer must differ.

Self-authorization fails.

The phase operator override is not treated as risk acceptance or activation approval.

## No backdating

If every gate eventually passes, P36 activation uses the timestamp of the successful activation observation.

The OE period is **not backdated** to:

- the generation-4 freeze
- the generation-3 freeze
- P34 point-in-time evidence
- P35 implementation
- the operator override
- any earlier production migration

The activator emits a real `mode: operating` evidence-period descriptor with:

- `backfilled: false`
- explicit start-authorization ID
- source activation ID

## Current blockers

The current OE period is **not started** because:

- generation 4 has not reached the 24-hour certification boundary;
- fresh spanning/terminal generation-4 samples are not yet complete;
- a generation-4 post-final-shared-change backup is not verified;
- P34-D001 remains `decision_required`;
- no independent activation authorization exists.

## Read-only remediation retest

`scripts/p36-remediation-retest.sql` is SELECT/CTE-only.

It rechecks:

- P18/P20/P21/P22
- cron state
- P34-D003 normal-client privilege posture
- P34-D002 privileged-RPC static invariants
- current migration head

No DDL/DML is included.

## Safety boundary

P36 does not automatically:

- mutate production data/schema
- change Auth settings
- upgrade Supabase
- accept paid cost
- accept risk
- close D001/D002/D003 without evidence
- promote P32 enforcement
- enable logging/pgAudit
- alter RLS/function grants/indexes
- fabricate backup evidence
- fabricate burn-in samples
- start/backdate OE

The only executed remediation in this phase is safe governance/repository state plus evidence-based state advancement.

## External assurance boundary

P36 activation, when it eventually occurs, begins an internal operating-effectiveness period.

It is **not an external attestation** and does not by itself prove SOC 2, ISO 27001 or any other certification.
