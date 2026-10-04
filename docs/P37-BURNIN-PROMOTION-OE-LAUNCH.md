# P37 — Burn-In Certification, Governance Stack Promotion & Operating-Effectiveness Launch

P37 is **engineering-active** by explicit operator override.

That override permits implementation and merge of the P37 control layer. It does **not** certify a burn-in window, accept security risk, purchase a Supabase plan, mutate production, or start/backdate operating effectiveness.

## What changed since P36

P36 froze generation 4 at `20261003221217_hub_h15_tms60_projection`.

Production subsequently moved again:

- database migration: `20261004132839_gomoku_p21_capacity_admission_gate`;
- semantic schema SHA remains `5b7b1caddef09b97f59c85d79d04eabfbe55120fe1754340a7367c1b14d39375`;
- `gomoku-room`: **v49** / `64e5cfdd7a9d027e178eb4e8466b954504eb2bec1021bcb40c19afe8cd05b900`;
- `micro-arcade-p31-backup-export`: **v2** / `84081a183835e6ea8c6791912a4e261b97d1e09c24c4fa6fdfc9a87f9e9460d2`;
- Edge functions: 12, all active;
- cron: 14/14 active;
- cron executions in the observed 24h: 5,791;
- cron failures: 0;
- blocking replication slots: 0;
- P18: clean;
- P20 schema drift: false;
- P21: pass;
- P22: pass.

The latest observed shared release change was `micro-arcade-p31-backup-export` v2 at:

`2026-10-04T16:20:09.879000Z`

Therefore **generation 4 is invalidated**. It is historical evidence only and may never be certified.

## Generation 5

P37 establishes generation 5 as the next candidate, but generation 5 is **not active yet**.

The strict P25 refreeze policy still requires a 60-minute quiet window plus control and backup revalidation.

Earliest quiet-window completion:

`2026-10-04T17:20:09.879000Z`

At the P37 live observation, Edge quiet was only about 1.56 minutes.

A new encrypted offsite backup after the final shared change is also not yet verified.

Current generation-5 state:

`waiting_quiet_window`

Current refreeze decision:

**blocked**

## Refreeze gate

`scripts/p37-evaluate-refreeze.py` requires all of the following:

- P25 is explicitly `refreeze_pending`;
- generation 4 is no longer eligible;
- generation 5 is the declared next candidate;
- migration, schema, Edge inventory, Gomoku Edge identity and cron inventory exactly match the candidate epoch;
- project `ACTIVE_HEALTHY`;
- all Edge Functions active;
- all expected cron jobs active;
- zero cron failures;
- zero blocking replication slots;
- P18 clean;
- P20 drift false;
- P21 pass;
- P22 pass;
- at least **60 continuous minutes** since the latest shared release change;
- successful encrypted backup after that final shared change;
- cross-app smoke pass;
- Auth, Realtime, PostgREST and Storage health pass;
- Security and Performance Advisor review.

If any release-epoch identity changes, the candidate is stale and a fresh quiet clock is required.

P37 does not automatically mutate P25 into generation 5. It produces a deterministic readiness receipt that can support a later reviewed refreeze.

## Burn-in sample identity

The P25 public health collector remains active as an operational monitor even while no burn-in generation is eligible.

Every sample now carries:

- `generation`;
- `generationState`;
- `currentGenerationEligible`;
- `qualifiesForBurnIn`.

While the platform is between generations, samples have `qualifiesForBurnIn: false`.

**Pre-refreeze samples do not qualify** for generation 5 later.

## Burn-in certification

`scripts/p37-certify-burnin.py` certifies only the current eligible generation.

There is no generation number hard-coded into the certifier.

Required evidence includes:

- active and eligible current P25 generation;
- non-invalidated generation;
- exact frozen migration/schema/Edge/cron identity;
- 24-hour minimum elapsed;
- at least 12 successful qualifying samples;
- all six 4-hour buckets across the first 24 hours;
- terminal qualifying sample at/after the 24-hour boundary;
- matching sample generation;
- `qualifiesForBurnIn: true`;
- verified post-final-change backup;
- current service/cross-app/advisor health.

A successful certificate receives a deterministic SHA-256 certificate ID.

Generation 4 cannot pass this certifier because it is no longer eligible.

## Governance stack promotion reality

The earlier staged P37 design assumed P26–P36 were waiting to be merged.

That is no longer true.

**P26–P36 are already merged** into `main`.

P37 therefore does not re-promote or batch-merge obsolete phase branches. Instead it certifies the exact merged lineage:

| Phase | PR | Merge SHA |
| --- | ---: | --- |
| P26 | #17 | `01f40c2ee4feaecd204bf5b87d6a79ac81da90a2` |
| P27 | #18 | `f4e9c2f23a799426ea3a60046094df5436947ab9` |
| P28 | #19 | `85f23ea62b6bd874100ba4d9a158bd9574431312` |
| P29 | #20 | `2c1bd74dfab8c45425054e552ba92bc65713c6b5` |
| P30 | #21 | `dd35a66826471b4cd94c1b9e8ead90be18dc1dc5` |
| P31 | #22 | `fd0f541fef82539c75ce3c4b429a222b4a20663f` |
| P32 | #23 | `0e7e48c57cc505ec0d42dcc706e364763b8e8c63` |
| P33 | #24 | `36793ca329a73fe7dba895e13ca753bc20349271` |
| P34 | #25 | `f50363813bddd86c6f2163f13254352685904afd` |
| P35 | #26 | `7b73e0b36cc55b7e7d6c6ea44162d97b16cdd59b` |
| P36 | #28 | `c8c374917d739c971fe142cf16c3449d6c64e8cd` |

`scripts/p37-certify-governance-stack.py` verifies this exact chain against the live release registry.

It also requires:

- 100% dependency-graph coverage;
- 100% registered-app governance coverage;
- no ungoverned fleet component;
- P32 at least warn;
- P32 bound to the current fleet/release registry;
- valid P33 ledger anchor;
- P34 control catalog `2026-10-03.1`;
- no already-started P35 evidence period;
- no false P36 OE-active state.

This certification is read-only and does not mutate Git.

## Current governance state

P31/P32 have been reconciled to the post-P36 live epoch.

- fleet registry: `2026-10-04.2`;
- release registry: `2026-10-04.2`;
- latest merged governance phase: P36;
- fleet governance: 18/18;
- registered apps: 7/7;
- dependency coverage: 100%;
- P32: **warn**;
- shared release epoch: `refreeze_pending_generation5`;
- shared/stateful promotion remains blocked until a stable certified epoch exists.

App-fast governed work is not automatically declared unsafe merely because the shared burn-in epoch is moving. Shared/stateful certification remains fail-closed.

## Advisor refresh

Current Security Advisor:

- 73 `rls_enabled_no_policy` INFO;
- 47 authenticated-callable `SECURITY DEFINER` WARN;
- 1 leaked-password-protection WARN.

Current Performance Advisor:

- 40 `auth_rls_initplan` WARN;
- 68 unindexed foreign-key INFO;
- 123 unused-index INFO.

P37 records these current counts and does not apply speculative RLS or index changes during the refreeze boundary.

## P34-D001

Supabase currently documents leaked-password protection as available on the **Pro Plan and above**.

Current aggregate Auth evidence:

- total users: 11;
- **11 Google** identity users;
- **0 password-auth** users;
- verified MFA factors: 0.

This reduces the present relevance of leaked-password credential stuffing but does not close the provider capability gap.

P37 therefore prepares a bounded treatment in:

`platform-p37-d001-risk-treatment.json`

Its state is:

`prepared_pending_independent_risk_approval`

It is **not active**.

Current properties:

- risk acceptance authorized: false;
- paid-plan upgrade authorized: false;
- permanent closure: false;
- independent approver: absent;
- active expiry: absent.

A future temporary acceptance must have a different requester and approver, an explicit approval reference, an expiry no longer than 90 days, and zero current password-auth users.

It reopens immediately if password authentication appears or another declared reopen condition occurs.

## OE launch

`scripts/p37-build-oe-launch.py` requires both:

1. a valid current-generation burn-in certificate;
2. a valid merged-governance-stack certificate.

It additionally requires:

- P32 at least warn;
- active P33 canonical evidence;
- frozen P34 catalog `2026-10-03.1`;
- P35 evidence-collection dry-run pass;
- zero critical deficiencies;
- D001 formally closed/remediated or independently accepted temporarily;
- D002 in an allowed high-deficiency state;
- D005 closed;
- D006 closed by current-generation stability certification;
- exact P33 anchor/P34 catalog/P34 snapshot hashes;
- exact burn-in/governance certificate IDs;
- explicit launch authorization;
- launch requester and authorizer must differ.

Self-authorization fails.

Fake baseline hashes fail.

Stale certificate IDs fail.

## No backdating

If every gate eventually passes, the OE period begins at the successful final P37 launch observation.

It is **not backdated** to:

- P36;
- generation 4;
- a future generation-5 freeze;
- the hosted PostgreSQL upgrade;
- P34/P35 evidence;
- the operator override;
- any earlier merge.

The launch receipt sets:

- `activationIsRetroactive: false`;
- 30-day internal operating-effectiveness minimum;
- 90-day external-readiness planning target;
- `externalAttestation: false`.

## Current launch state

**OE is not started.**

Current blockers are:

1. generation 4 is invalidated;
2. generation 5 has not passed the 60-minute quiet/refreeze gate;
3. a post-final-change backup is not verified;
4. generation 5 therefore has no valid 24-hour burn-in evidence;
5. P34-D001 has no independent disposition;
6. no independent P37 launch authorization exists.

## Safety boundary

P37 does not automatically:

- write production database data/schema;
- deploy Edge Functions;
- change cron;
- alter Auth configuration;
- enable leaked-password protection;
- upgrade Supabase;
- approve cost;
- accept risk;
- rewrite RLS;
- create/drop indexes;
- fabricate backup or sample evidence;
- re-merge P26–P36;
- start/backdate OE;
- claim SOC 2, ISO 27001 or another external attestation.

The phase can be engineering-complete while the real operational launch remains correctly blocked.
