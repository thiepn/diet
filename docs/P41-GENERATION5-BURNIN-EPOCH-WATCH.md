# P41 — Generation-5 Burn-In Evidence Accumulation, Epoch Watch & Certification Readiness

P41 evaluates the generation-5 burn-in against the exact frozen shared-platform epoch established by P40. The result is fail-closed: generation 5 **must not be certified** after any frozen epoch identity changes.

## Live result

Generation 5 activated at `2026-10-04T18:52:01.712991Z`.

The first post-activation shared migration landed at `2026-10-04T18:58:02Z`:

- `20261004185802_studyos_p7_master_map_and_packet`

That is only about six minutes after activation. Later StudyOS migrations moved the live head to:

- `20261004192902_studyos_p8_checkpoint_dimension_evidence`

The platform semantic fingerprint changed from:

- frozen: `5b7b1caddef09b97f59c85d79d04eabfbe55120fe1754340a7367c1b14d39375`
- live: `b40d9a3d1da7c39917f41a9c1f8e95615838b7f34a64e673191bf810833f7cd2`

The Diet schema itself still reports the original Diet fingerprint and P20 reports no Diet drift. The invalidation is therefore a **shared release epoch change**, not a Diet schema regression.

## Health at observation

At `2026-10-04T19:44:10.276405Z`:

- project: ACTIVE_HEALTHY
- Edge Functions: 12/12 active
- `gomoku-room`: v50, unchanged
- cron: 14/14 active
- cron failures over the current 24-hour view: 0
- blocking replication slots: 0
- P18: clean
- P20: no Diet schema drift
- P21: pass
- P22: pass
- security and performance advisors: reviewed

This is a certification-invalidation event, not an outage.

## Evidence disposition

No qualifying generation-5 public sample is known inside the approximately six-minute valid epoch window. Even if later samples are healthy, they cannot certify generation 5 because they were collected after the frozen shared epoch changed.

Therefore:

- generation 5: `invalidated_epoch_changed`
- certification readiness: false
- P26 steady state: remains staged
- operating effectiveness: not started
- shared/stateful promotion safety: remains amber/blocked

## Generation 6 candidate

P41 opens generation 6 candidate revision 1 against the latest observed shared epoch.

Candidate:

- migration: `20261004192902_studyos_p8_checkpoint_dimension_evidence`
- semantic fingerprint: `b40d9a3d1da7c39917f41a9c1f8e95615838b7f34a64e673191bf810833f7cd2`
- Edge inventory: unchanged
- `gomoku-room`: v50
- cron inventory: unchanged

The latest shared change is `2026-10-04T19:29:02Z`, so the earliest 60-minute refreeze boundary is `2026-10-04T20:29:02Z`.

P15 encrypted backup run **37222829955** was created at `18:03:25Z`, before the latest shared change. It is valid historical backup evidence but **not fresh for generation 6**.

Generation 6 therefore remains blocked on:

1. a verified encrypted P15 backup created after `2026-10-04T19:29:02Z`;
2. at least 60 minutes with no later shared epoch change;
3. the normal migration/schema/Edge/cron and health revalidation.

The P15 workflow already has an hourly `47 * * * *` refreeze-pending path. Returning P25 to `refreeze_pending` re-enables that backup acquisition without introducing production mutation.

## Certification-readiness engine

`scripts/p41-evaluate-burnin-epoch.py` has two paths:

- frozen epoch changed → invalidate the current generation immediately and open the next refreeze candidate;
- frozen epoch unchanged → accumulate only successful, generation-matching, post-activation samples, require all six 4-hour buckets, require at least 12 samples, require the 24-hour boundary, and require a terminal sample.

The evaluator is deterministic and evidence-only. It does not mutate Supabase, deploy Edge Functions, change cron, certify a broken generation, or start OE.
