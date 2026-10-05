# P41 — Generation-5 Burn-In Evidence Accumulation, Epoch Watch & Certification Readiness

P41 evaluates whether the Generation-5 burn-in that began in P40 can still become certifiable.

## Result

**Generation 5 is invalidated and cannot be certified.**

P40 activation itself remains valid historical evidence: Generation 5 was legitimately activated at `2026-10-04T18:52:01.712991Z` against the frozen `20261004173117_gomoku_p23_security_admission_gate` epoch. P40 did not certify the burn-in.

The first database migration after activation was:

`20261004185802_studyos_p7_master_map_and_packet`

That change occurred only about six minutes after activation. The P25 contract requires a continuous 24-hour window on one frozen shared epoch, so later health samples cannot repair or extend Generation 5.

## Current live epoch

The P41 live observation at `2026-10-05T13:34:41.824Z` found:

- project: `THIEPN Account` / `hycegznamzjhwinegaai`
- project status: `ACTIVE_HEALTHY`
- current migration head: `20261005133228_hub_h18_notes_capture`
- current semantic schema SHA: `1eae1abf885890d48336ee5c4e29e2d4054987cfc7dea6053f694b3480548ca1`
- Edge Functions: 12, all active
- `gomoku-room`: v50, unchanged from P40
- cron: 14/14 active
- persistent blocking replication slots: 0

The database/schema epoch changed even though the highlighted Gomoku Edge Function stayed on v50. A shared epoch is composite; one stable component cannot cancel a database migration change.

## Certification guard

`scripts/p41-certification-readiness.py` adds a fail-closed readiness decision over:

1. the P25 frozen epoch;
2. the current live observation;
3. optional qualifying burn-in samples;
4. the 24-hour boundary and coverage requirements.

If any frozen epoch identity differs, the evaluator returns `blocked_epoch_changed`, sets `requiresNewGeneration=true`, and refuses certification.

Historical P40 activation evidence is preserved rather than rewritten. This keeps activation truth separate from later certification truth.

## Evidence accumulation rule

Only evidence collected while the exact frozen epoch remains unchanged is eligible. Evidence after `studyos_p7_master_map_and_packet` does not qualify for Generation 5.

The valid Generation-5 same-epoch window lasted roughly **6.005 minutes**, far below the required 24 hours.

## Next generation

P41 therefore hands off to **Generation 6**.

Generation 6 must:

1. freeze the latest exact migration/schema/Edge/cron epoch;
2. observe at least 60 minutes of quiet after the final shared change;
3. capture a verified encrypted backup after that final change;
4. activate from reviewed refreeze evidence;
5. begin a fresh, non-retroactive 24-hour burn-in;
6. accumulate the required samples, six 4-hour coverage buckets, and terminal sample.

No Generation-5 sample may be re-labelled as Generation 6 evidence.

## Safety boundary

P41 is read-only with respect to production. It does not change the database, deploy Edge Functions, alter cron, accept risk, backdate evidence, or fabricate certification.
