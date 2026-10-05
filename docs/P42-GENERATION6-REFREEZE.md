# P42 — Generation-6 Refreeze Candidate, Fresh Backup, Quiet-Window Qualification & Activation Readiness

P42 establishes a churn-safe Generation 6 refreeze process after P41 invalidated Generation 5.

## Current candidate — revision 4

Shared-platform development continued during P42, so earlier candidates were invalidated and rebased rather than incorrectly promoted.

The current captured candidate is:

- observed: `2026-10-05T14:42:07Z`
- migration: `20261005143803_studyos_p11_calendar_deadline_sync`
- shared semantic schema SHA: `c49004e0f9702ef485b66c0b34e780209a676df02e8313eeeaa29a71467d9d0e`
- Edge Functions: 12 / all active
- `gomoku-room`: v50
- cron: 14/14 active
- P18 integrity: clean
- P20 schema drift: false
- P21 readiness: pass
- P22 maintenance: pass

Generation 6 is **not activated**.

## Fresh backup achieved

After P42's churn-safe workflow changes were merged, the repository immediately triggered a new encrypted P15 backup.

- P15 run: `37326652281` / #36
- result: success
- artifact ID: `11351813929`
- artifact digest: `sha256:48f6b3a29e4492ddaa5e65152910333bb5e2f4d1d8342ab84a2d7094ee9a5e6d`
- workflow created: `2026-10-05T14:40:51Z`
- artifact created: `2026-10-05T14:41:29Z`

The latest shared migration occurred at `2026-10-05T14:38:03Z`, so backup run #36 is **fresh** for candidate revision 4.

The fresh-backup gate is therefore satisfied.

## Quiet-window gate

P42 still requires a full **60-minute** unchanged shared epoch.

Candidate revision 4 begins at:

`2026-10-05T14:38:03Z`

At the captured observation only **4.07 minutes** had elapsed.

Earliest possible activation-readiness boundary for this exact candidate:

`2026-10-05T15:38:03Z`

The quiet window is now the only known blocker. Any later migration, semantic-schema change, Edge deployment, or cron identity change resets the candidate and may invalidate backup freshness again.

## Churn-safe refreeze policy

Any shared-epoch identity change:

1. invalidates the current candidate;
2. increments the candidate revision;
3. resets the 60-minute quiet clock;
4. recomputes backup freshness;
5. blocks activation until all gates are satisfied again.

P15 also now supports Generation-6 refreeze directly:

- hourly `47 * * * *` backup opportunities run while P42 is `refreeze_pending`;
- `platform-p42-*.json` updates trigger new P15 backup opportunities on push.

## Activation-readiness evaluator

`scripts/p42-evaluate-generation6-readiness.py` fails closed unless all conditions hold simultaneously:

1. exact migration/schema/Edge/cron candidate unchanged;
2. project status healthy;
3. P18 clean;
4. P20 no drift;
5. P21 pass;
6. P22 pass;
7. all Edge Functions active;
8. all cron jobs active with zero 24-hour failures;
9. no blocking persistent replication slots;
10. at least 60 quiet minutes;
11. valid encrypted backup captured after the latest shared change.

The current deterministic result is **blocked**, with only the quiet window remaining for the captured revision-4 candidate.

A later epoch change still overrides that statement immediately because activation always requires a fresh live recheck.

## Safety boundary

P42 does not:

- mutate production schema or data;
- deploy Edge Functions;
- alter Supabase cron;
- activate Generation 6;
- start the Generation-6 24-hour burn-in;
- reuse Generation-5 evidence;
- backdate backup evidence;
- bypass the quiet window.

P42 provides candidate reconciliation, fresh-backup automation, and fail-closed activation readiness only.
