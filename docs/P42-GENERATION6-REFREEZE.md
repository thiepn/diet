# P42 — Generation-6 Refreeze Candidate, Fresh Backup, Quiet-Window Qualification & Activation Readiness

P42 creates and continuously reconciles the Generation 6 refreeze candidate after P41 invalidated Generation 5.

## Candidate revision 2

The first Generation-6 candidate used migration `20261005134753_library_account_deletion_authority` and semantic schema fingerprint `c21d8c196b3a0ea43b5232815adcaf915c9e5012fcc0208cd17216fae19a8af8`.

During the post-merge backup recheck, the migration head remained unchanged but the shared semantic schema fingerprint changed to:

`c91f0cf78cc6db7399081fd3fd0595ef84f0c0b4517d11a4767c3f2464bac174`

Repeated reads returned the same new fingerprint, so P42 treats this as a real shared-epoch change rather than a nondeterministic hash. Because the exact change time is not independently attested, the fail-closed quiet clock restarts at its observation time:

`2026-10-05T14:25:28Z`

Candidate revision 2 therefore remains on:

- migration: `20261005134753_library_account_deletion_authority`
- semantic schema SHA: `c91f0cf78cc6db7399081fd3fd0595ef84f0c0b4517d11a4767c3f2464bac174`
- Edge Functions: 12 / all active
- `gomoku-room`: v50
- cron: 14/14 active
- P18 integrity: clean
- P20 schema drift: false
- P21 readiness: pass
- P22 maintenance: pass

Generation 6 is **not activated**.

## Quiet-window gate

P42 requires a **60-minute** quiet window on the exact migration/schema/Edge/cron candidate.

Because revision 2 was rebased at `2026-10-05T14:25:28Z`, the earliest possible activation-readiness boundary is:

`2026-10-05T15:25:28Z`

Any later shared schema mutation, migration, Edge deployment, or cron identity change resets the candidate again.

## Backup gate

The P42 merge successfully triggered a new encrypted offsite backup:

- P15 run: `37324434181` / #35
- workflow result: success
- artifact ID: `11351740690`
- artifact digest: `sha256:230a14f88817a89cae23ff6856724ae1524b1ca0528228e842d9f3997f9e4b9a`
- artifact created: `2026-10-05T14:25:00Z`

The backup is valid, encrypted, and unexpired. However, candidate revision 2 was observed at 14:25:28Z, 28 seconds after that artifact was created, so run #35 is conservatively marked **stale** for revision 2.

P42 now makes backup recovery automatic in two ways:

1. the hourly `47 * * * *` P15 opportunity runs while the P42 Generation-6 state is `refreeze_pending`;
2. changes to `platform-p42-*.json` are P15 push triggers, so candidate/evidence updates create another immediate fresh-backup opportunity.

## Deterministic activation-readiness gate

`scripts/p42-evaluate-generation6-readiness.py` requires simultaneously:

1. exact candidate migration/schema/Edge/cron identity unchanged;
2. project status healthy;
3. P18 clean;
4. P20 drift false;
5. P21 pass;
6. P22 pass;
7. every Edge Function active;
8. all cron jobs active with no 24-hour failures;
9. no blocking persistent replication slots;
10. at least 60 minutes of quiet;
11. a valid encrypted backup captured after the latest candidate change.

Current decision: **blocked**.

Current blockers are the open quiet window and stale backup. The backup automation will keep creating post-candidate opportunities, but readiness cannot be declared until the exact candidate survives the full 60-minute window.

## Why the migration head alone is insufficient

P42 explicitly treats the semantic schema fingerprint as part of the shared epoch. A stable migration head does not prove schema stability when direct or otherwise untracked schema changes are possible.

This closes the gap that caused Generation 5 to become invalid shortly after activation.

## Safety boundary

P42 does not:

- mutate the production database;
- deploy an Edge Function;
- alter Supabase cron;
- activate Generation 6;
- start the Generation-6 burn-in clock;
- reuse Generation-5 evidence;
- backdate backup evidence;
- bypass the 60-minute quiet window.

P42 only stages and reconciles the candidate, creates fresh-backup opportunities, and proves whether activation is currently allowed.
