# P38 — Generation-5 Refreeze Activation, Burn-In Start & Evidence Continuity

P38 continues directly from merged P37.

Its job is not to invent another governance layer. It implements the transition that P37 deliberately left unresolved:

`refreeze_pending -> generation 5 active -> burn-in evidence accumulating -> P37 certification`

P38 is engineering-active by operator override. That override does **not** authorize generation activation, backup fabrication, production mutation, early certification, or OE launch.

## Current production observation

Observed at `2026-10-04T17:01:57.419724Z`:

- project: `ACTIVE_HEALTHY`
- migration: `20261004132839_gomoku_p21_capacity_admission_gate`
- semantic schema SHA: `5b7b1caddef09b97f59c85d79d04eabfbe55120fe1754340a7367c1b14d39375`
- Edge Functions: 12, all active
- `gomoku-room`: v49
- `micro-arcade-p31-backup-export`: v2
- cron: 14/14 active
- cron failures in 24h: 0
- blocking replication slots: 0
- P18: clean
- P20 drift: false
- P21: pass
- P22: pass

Current advisor snapshot:

- Security: 73 RLS-without-policy INFO, 50 authenticated-callable SECURITY DEFINER WARN, 1 leaked-password-protection WARN
- Performance: 40 auth RLS init-plan WARN, 68 unindexed-FK INFO, 122 unused-index INFO

P38 records these counts but does not perform speculative advisor remediation during the refreeze boundary.

## Generation 5 is not active

The latest shared Edge change remains:

`micro-arcade-p31-backup-export v2 @ 2026-10-04T16:20:09.879000Z`

At the P38 observation, only **41.79 minutes** of the required **60-minute** quiet window had elapsed.

Earliest quiet completion remains:

`2026-10-04T17:20:09.879000Z`

A verified post-final-change encrypted backup is also still absent.

Therefore generation 5 is not active and P38's current refreeze decision is **blocked**.

## Activation is preview-only

`scripts/p38-activate-generation5.py` consumes a P37 refreeze receipt.

It refuses activation unless the receipt says:

`ready_to_activate_generation5`

and additionally verifies:

- generation = 5;
- no refreeze errors;
- a frozen epoch exists;
- the backup prerequisite is true;
- a backup evidence reference exists;
- P25 is still `refreeze_pending`;
- generation 4 is ineligible;
- `nextGeneration = 5`;
- the frozen migration/schema/Edge/cron identity still matches the generation-5 candidate.

On success it creates a **preview-only** set of four artifacts:

1. generation-5 P25 state;
2. generation-5 backend metadata;
3. generation-5 public app health metadata;
4. deterministic activation receipt.

The activator itself does not edit any source file and does not mutate Supabase.

A reviewed repository update can later apply those generated artifacts after a real ready refreeze receipt exists.

## Generation-5 state produced by a valid activation

A valid preview changes the intended state to:

- P25 state: `burn_in_active`
- generation: 5
- generation state: `burn_in_active`
- current generation eligible: true
- next generation: null
- activatedAt: exact successful refreeze observation
- minimumCompleteAfter: activation + 24 hours
- backup evidence: exact verified reference from the refreeze receipt

It does not reuse the generation-4 activation time.

## Evidence continuity

`scripts/p38-burnin-progress.py` tracks generation-5 progress.

A sample counts only when:

- sample generation matches the current active generation;
- `qualifiesForBurnIn: true`;
- sample is healthy/successful;
- timestamp is at or after activation;
- timestamp is not in the future relative to the observation;
- it is not a duplicate.

P38 rejects and reports:

- wrong-generation samples;
- pre-activation samples;
- non-qualifying samples;
- unhealthy/failed samples;
- future-dated samples;
- duplicate run IDs.

Duplicate evidence cannot inflate the count.

## Burn-in completion shape

P38 does not replace P37 certification.

It only determines whether the evidence set is ready to be handed to P37.

Required evidence remains:

- at least 12 successful qualifying samples;
- all six 4-hour buckets across the first 24 hours;
- minimum 24 hours elapsed;
- terminal sample at or after `minimumCompleteAfter`.

Until all are present, state is `evidence_accumulating`.

When all are present, P38 reports:

`readyForP37Certification: true`

The actual certificate is still produced by `scripts/p37-certify-burnin.py`, which additionally binds current live epoch and service/advisor health.

## Adversarial coverage

P38 tests explicitly prove that:

- the current real state remains blocked;
- a missing backup blocks refreeze;
- a quiet window below 60 minutes blocks refreeze;
- a blocked P37 receipt cannot create generation-5 activation files;
- a future legitimate receipt can generate a deterministic activation preview;
- preview generation does not modify source files;
- generation-4 samples do not count;
- pre-activation samples do not count;
- duplicate samples count once;
- non-qualifying samples do not count;
- a missing 4-hour bucket blocks readiness even when the total sample count is high;
- a complete six-bucket + terminal evidence set becomes ready for P37 certification.

## Safety boundary

P38 does not:

- deploy Supabase migrations;
- deploy Edge Functions;
- change cron;
- alter Auth;
- create paid resources;
- claim a backup exists when it does not;
- activate generation 5 before a real ready receipt;
- automatically commit activation state;
- count pre-activation evidence;
- certify burn-in;
- start OE;
- backdate any evidence period.

The engineering phase can be merged while the real generation-5 activation remains blocked.

P38 does **not start OE**; OE remains owned by the independently authorized P37 launch gate after a valid burn-in certificate exists.
