# P40 — Generation-5 Activation, Frozen-Epoch Commit & Burn-In Evidence Start

P40 performs the first legitimate generation-5 activation after the P38/P39 refreeze tooling was put in place.

## Activation decision

Generation 5 activated at:

`2026-10-04T18:52:01.712991Z`

Minimum 24-hour completion boundary:

`2026-10-05T18:52:01.712991Z`

The P37 refreeze decision is:

- decision: `ready_to_activate_generation5`
- generation: 5
- decision ID: `4153ec4f7fc90a3afcacc59e61e7fcd78e571b2b2aa5012caa175920f0547e78`
- quiet observed: **75.38 minutes**
- required quiet: 60 minutes
- errors: none

The P38 deterministic activation receipt is:

`0867969dce6fd97d914c260b2040bdd2243142ff184bb45f9ed4fb46f179ee0f`

## Frozen epoch

Generation 5 is bound to the exact shared-platform epoch:

- migration: `20261004173117_gomoku_p23_security_admission_gate`
- semantic schema SHA: `5b7b1caddef09b97f59c85d79d04eabfbe55120fe1754340a7367c1b14d39375`
- Edge Functions: 12 / all active
- `gomoku-room`: v50
- `gomoku-room` SHA: `a537d0702fdb53861124849e03fb7141a8036a4ee5c692fa9bf4769c47981695`
- cron: 14/14 active
- cron failures in the live check: 0
- blocking replication slots: 0
- P18: clean
- P20 schema drift: false
- P21: pass
- P22: pass

Any later change to the frozen migration/schema/Edge/cron identity invalidates this generation for certification.

## Encrypted backup evidence

P15 encrypted offsite backup **run 37222829955 / #29** succeeded after the final shared change.

Evidence:

- verification completed: `2026-10-04T18:03:24Z`
- artifact created: `2026-10-04T18:03:25Z`
- source commit: `bb6c632090fcb10ec51fab651ea0df0900d53821`
- artifact ID: 11311011119
- artifact: `diet-p15-offsite-37222829955`
- artifact digest: `sha256:432279d9ab3fc204061a89afc20869bf0994f6604ec586205081897b932049cb`
- encryption: CMS AES-256-GCM
- snapshot count: 1
- total rows: 282
- backup schema SHA: `9960c954d3812a1fb178e823830c247aa5e67f115c58dad4170faa9218dce02c`

This backup is both valid and fresh for candidate revision 2.

## Live public-health evidence

P25 public burn-in run **37224033250 / #26** completed successfully at `2026-10-04T18:20:14Z`.

All probe checks passed:

- production Diet shell: 200
- Auth health: 200
- `platform-health`: 200 / healthy
- P23 operator RPC denied to public client as required
- P24 execution RPC denied to public client as required
- P24 post-upgrade RPC denied to public client as required

The sample does **not** count toward generation-5 burn-in because it occurred before generation 5 activated. It is used only as activation-time health evidence.

## Storage and advisors

The activation observation also rechecked the shared service state:

- storage buckets readable: 3
- storage objects readable: 14
- Security advisors reviewed
- Performance advisors reviewed

Existing advisor findings remain governed review items; P40 does not auto-remediate them.

## Burn-in evidence rules

Generation 5 is now in `burn_in_active`.

Only samples satisfying all of these conditions count:

1. generation is exactly 5;
2. `qualifiesForBurnIn == true`;
3. timestamp is at or after activation;
4. the sample is healthy and successful;
5. duplicate run IDs count once.

Certification still requires:

- at least 12 successful qualifying samples;
- all six 4-hour coverage buckets;
- a terminal qualifying sample at or after `2026-10-05T18:52:01.712991Z`;
- exact frozen epoch unchanged;
- final service, control, and advisor revalidation.

P26 remains staged until that certification succeeds.

## Governance state

P31 fleet registry is now `2026-10-04.4`.

P32 policy bundle is now `2026-10-04.4` and remains **warn** mode.

Release safety remains **amber** while generation 5 accumulates burn-in evidence. Shared/stateful promotion remains blocked.

## Safety boundary

P40 changes repository control/evidence state only.

It does not:

- mutate production database data or schema;
- deploy an Edge Function;
- alter Supabase cron;
- change billing or the Supabase plan;
- fabricate or backdate a backup;
- count pre-activation samples;
- certify the burn-in before the 24-hour boundary;
- start or backdate OE.

Generation 5 is legitimately active, but it is **not yet certified**.
