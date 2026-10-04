# P39 — Refreeze Candidate Reconciliation, Epoch-Churn Resilience & Backup Freshness Automation

P39 continues from P38 and addresses the problem that repeatedly invalidated the burn-in boundary: the shared Supabase project can move because another app releases while Diet is waiting for a quiet window.

The solution is **not** to consume a new burn-in generation number for every pre-activation change.

**Generation 5 remains generation 5** until it actually activates. Its candidate epoch is revisioned and rebased safely.

## Current epoch movement

P38 observed the generation-5 candidate at Gomoku P21 / `gomoku-room` v49.

Before generation 5 activated, the shared project moved again.

P39 live observation at `2026-10-04T17:40:47.662109Z`:

- project: `ACTIVE_HEALTHY`
- migration: `20261004173117_gomoku_p23_security_admission_gate`
- semantic schema SHA: `5b7b1caddef09b97f59c85d79d04eabfbe55120fe1754340a7367c1b14d39375`
- Edge Functions: 12 / all active
- `gomoku-room`: **v50**
- `micro-arcade-p31-backup-export`: v2
- cron: 14/14 active
- cron failures: 0
- blocking replication slots: 0
- P18 clean / P20 drift false / P21 pass / P22 pass

The latest shared change is `gomoku-room` v50 at:

`2026-10-04T17:36:39.032000Z`

The generation-5 candidate therefore becomes **revision 2**.

## Quiet clock

P39 resets the quiet clock to the actual latest shared change.

At the live observation:

- quiet observed: **4.14 minutes**
- required: **60 minutes**
- earliest possible refreeze: `2026-10-04T18:36:39.032000Z`

This is a reset of the candidate boundary, not creation of generation 6.

## Backup #28: successful but stale

A real P15 encrypted offsite backup succeeded before the P23/v50 movement:

- workflow: P15 Encrypted Offsite Backup
- run: **37218356705** / run number 28
- created: `2026-10-04T16:52:34Z`
- export verification: pass
- snapshot count: 1
- rows: 282
- encryption: CMS AES-256-GCM
- artifact: `diet-p15-offsite-37218356705`
- artifact ID: 11309815027
- artifact retained: yes
- artifact digest: `sha256:3c5acd5fca64f6dbed7df766eab0bd0c86fe61ee267d97d706e7e0ad25fae874`

The backup itself is valid.

It is **successful but stale** only for the current refreeze candidate because `16:52:34Z` is earlier than the v50 final change at `17:36:39Z`.

P39 does not relabel a successful backup as a failure.

## Candidate reconciliation

`scripts/p39-reconcile-refreeze-candidate.py` accepts:

1. a current live epoch observation;
2. encrypted-backup evidence;
3. the current P25 state.

If the shared epoch moved before activation it:

- preserves target generation 5;
- increments candidate revision;
- replaces the candidate migration/schema/Edge/cron identity;
- resets the 60-minute quiet clock;
- recalculates backup freshness;
- retains the previous candidate as history;
- emits a deterministic reconciliation receipt;
- writes preview output only.

It does not mutate Supabase or source files.

A candidate can become ready only when the epoch is healthy, 60 minutes quiet, and the encrypted backup is both valid **and captured after the latest shared change**.

## Refreeze-only hourly backup cadence

The existing P15 encrypted-backup workflow now has two scheduled opportunities:

- daily: `17 4 * * *`
- refreeze helper: `47 * * * *`

The hourly opportunity does **not** create hourly backups permanently.

On the hourly schedule the workflow reads `platform-p25-burn-in-plan.json`.

It performs the backup only when:

`state == "refreeze_pending"`

Otherwise the hourly opportunity exits without fetching or encrypting user data.

Push-triggered, manual, and normal daily backups continue to run as before.

Encryption, OIDC authentication, verification and 90-day artifact retention are unchanged.

This means a cross-app shared release no longer normally forces Diet to wait until the next day's scheduled offsite backup before it can establish a fresh candidate.

## Control-plane reconciliation

P39 refreshes live epoch bindings without changing dependency topology:

- P29 topology remains 18 nodes / 51 edges;
- P31 fleet registry becomes `2026-10-04.3`;
- P32 policy bundle becomes `2026-10-04.3`;
- P32 remains **warn** mode;
- release safety remains **amber**;
- shared/stateful promotion remains blocked;
- registered-app and dependency coverage remain 100%.

## Current state

Generation 5 remains inactive.

Current blockers:

1. the v50 candidate has only 4.14/60 quiet minutes;
2. backup run 37218356705 predates the v50 final change.

P39 **does not activate generation 5**.

Once a fresh backup exists and the v50-or-later final candidate remains quiet for 60 continuous minutes, P37 can issue a ready refreeze receipt and P38 can generate the reviewed activation preview.

If another shared release occurs first, P39 rebases the still-unactivated generation-5 candidate again instead of incorrectly creating generation 6.

## Safety boundary

P39 does not:

- mutate the production database;
- deploy an Edge Function;
- modify cron inside Supabase;
- fabricate backup evidence;
- count a stale backup as fresh;
- treat candidate movement as a completed burn-in generation;
- automatically commit generation activation;
- certify burn-in;
- launch or backdate OE;
- upgrade the Supabase plan.

The engineering phase may merge while the operational generation-5 gate remains fail-closed.
