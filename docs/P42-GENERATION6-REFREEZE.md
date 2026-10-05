# P42 — Generation-6 Refreeze Candidate, Fresh Backup, Quiet-Window Qualification & Activation Readiness

P42 establishes a churn-safe Generation 6 refreeze process after P41 invalidated Generation 5.

## Current candidate — revision 3

The shared project continued changing while P42 was being validated. Candidate revision 2 was therefore invalidated before activation.

The latest observed candidate is:

- observed: `2026-10-05T14:35:59Z`
- migration: `20261005142947_studyos_p11_calendar_autopilot_foundation`
- shared semantic schema SHA: `48825c23f56020022a058504e069d4c7f8d6a096331560b6999ec501df4f5fcf`
- Edge Functions: 12 / all active
- `gomoku-room`: v50
- cron: 14/14 active
- P18 integrity: clean
- P20 schema drift: false
- P21 readiness: pass
- P22 maintenance: pass

Generation 6 is **not activated**.

## Churn-safe refreeze rule

P42 no longer assumes that a candidate observed once remains current.

Any change in migration identity, shared semantic schema fingerprint, Edge identity, or cron identity:

1. invalidates the current candidate;
2. increments the candidate revision;
3. resets the 60-minute quiet clock;
4. invalidates backup freshness if the backup predates the new candidate;
5. blocks activation until all gates are re-satisfied.

This protects Generation 6 from the same class of shared-epoch churn that invalidated Generation 5.

## Quiet-window gate

Candidate revision 3 begins from the latest shared migration at:

`2026-10-05T14:29:47Z`

The required quiet period is **60 minutes**.

At the revision-3 observation only about **6.20 minutes** had elapsed.

Earliest possible activation-readiness boundary for this exact candidate:

`2026-10-05T15:29:47Z`

A later shared change resets that boundary again.

## Backup gate

The latest successful encrypted offsite backup currently bound to P42 is:

- P15 run: `37324434181` / #35
- result: success
- artifact ID: `11351740690`
- artifact digest: `sha256:230a14f88817a89cae23ff6856724ae1524b1ca0528228e842d9f3997f9e4b9a`
- artifact created: `2026-10-05T14:25:00Z`

The backup is valid, encrypted, and unexpired, but it is **stale** for revision 3 because the latest shared migration occurred at 14:29:47Z.

P42 extends P15 automation so that:

- hourly `47 * * * *` backup opportunities run whenever Generation 6 is `refreeze_pending`;
- changes to `platform-p42-*.json` trigger a new backup on push.

This means candidate churn automatically creates another post-change backup opportunity without weakening the gate.

## Activation-readiness evaluator

`scripts/p42-evaluate-generation6-readiness.py` fails closed unless all conditions are true simultaneously:

1. exact candidate migration/schema/Edge/cron identity remains unchanged;
2. project is healthy;
3. P18 is clean;
4. P20 reports no drift;
5. P21 passes;
6. P22 passes;
7. all Edge Functions are active;
8. all cron jobs are active and no 24-hour failures exist;
9. there are no blocking persistent replication slots;
10. at least 60 quiet minutes have elapsed;
11. a verified encrypted backup was captured after the latest shared change.

The evaluator also includes adversarial coverage proving that a later epoch change blocks activation even if enough time has elapsed and a backup exists.

## Current decision

**Blocked.**

Current blockers:

- quiet window incomplete;
- latest backup predates candidate revision 3.

This is an expected safe state while the shared Supabase project is still changing.

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

P42 only manages candidate identity, backup freshness, quiet-window qualification, and deterministic activation readiness.
