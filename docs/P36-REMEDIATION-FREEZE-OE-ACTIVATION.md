# P36 — Remediation Execution, Stable-Epoch Freeze & Operating-Effectiveness Activation

P36 is **staged, not active**.

The important difference from P26–P35 is that one prerequisite has now been executed outside the future stack:

**P25 remains the active operations phase on main, but generation 2 is invalid and no certifiable burn-in generation is active.**

Main commit: `f722d576b483991adaa865e188cc04bea583e6a6`.

P36 itself remains downstream of P35 and does not skip that dependency chain.

## 1. Historical freeze invalidated; generation 3 pending

The current shared epoch was frozen at `2026-10-02T14:32:00.744993Z`.

Frozen identity:

- migration: `20261002095255_gomoku_p16_certification_null_fix`
- semantic SHA: `af9cc4acbed9e61bc81f48642f75b1c2e2841ebdf52a5139f14e784e509aecad`
- `gomoku-room`: v42
- Edge SHA: `fc63d31db8a51b860fc45aa7148fc864f8b2622fc469e495123e9a950273687d`
- cron jobs: 11

At activation the migration had been quiet for approximately 279 minutes and the Gomoku Edge deployment for approximately 283 minutes.

A recheck at `2026-10-02T14:46:08.606027Z` matched the frozen identity exactly.

The generation 2 freeze was later invalidated by Gomoku P17 changes and is archival evidence only.

The latest observed shared epoch is now:

- migration: `20261002152739_gomoku_p17_certification_health_isolation`
- semantic SHA: `d5c977fc0d74ea6745ac588fc90656dadc18ee0568c3ac248cfd7540ceb6de00`
- `gomoku-room`: **v45**
- Edge SHA: `70e86288e735659c4f0a3c9a2608acf48305ae73afe915fefb22add8f293a2de`

Generation 3 is refreeze-pending. The current earliest refreeze is `2026-10-02T18:21:44.278Z`, subject to a fresh quiet-window, control, and backup recheck.

## 2. Remediation execution

P36 executes evidence-based dispositions for three P34 deficiencies without changing production.

### P34-D002 — privileged SECURITY DEFINER review

Result: **closed by documented design**, with regression guards.

Current live class:

- 39 authenticated-callable public `SECURITY DEFINER` RPCs;
- 0/39 executable by `anon`;
- 39/39 reference `auth.uid()`;
- 39/39 have controlled empty `search_path`;
- 21/39 also reference `auth.jwt()`;
- 33/39 contain explicit rejection paths.

The six without explicit `RAISE` behavior were manually reviewed: `claim_notes_sync_access(text)`, `disable_notes_sync_access()`, `has_notes_sync_access()`, `list_notes_auth_sessions()`, `list_thiepn_account_sessions()`, and `notes_auth_identity_delete_status()`.

They either return false/status for invalid state or constrain read/write behavior to the current `auth.uid()`. The Supabase advisor may continue reporting this design class because it intentionally exposes authenticated privileged RPCs. The deficiency reopens if anon execution appears, subject binding disappears, search-path hardening regresses, or cross-user tests fail.

### P34-D003 — RLS enabled with no policy

Result: **closed by documented design**, with a grant regression guard.

P36's latest live retest finds:

- **58** RLS-enabled/no-policy public relations;
- **0** with direct `anon` SELECT/INSERT/UPDATE/DELETE privileges;
- **0** with direct `authenticated` SELECT/INSERT/UPDATE/DELETE privileges.

Supabase documents that RLS with no applicable policy denies row access through the API. In this fleet the class is also not directly granted to normal API roles. P36 therefore treats these as intentional service-only/deny-by-default relations rather than creating permissive policies merely to remove an INFO lint.

The control reopens if a no-policy relation gains direct normal-client privileges or a user-facing access requirement is introduced without a policy design.

### P34-D005 — unresolved ownership

Result: **closed; ownership resolved to Diet**.

Both `public.change_log` and `public.training_distribution_settings` originate in migration `20260912192748_thiepn_account_diet_core`. `training_distribution_settings` is additionally referenced throughout Diet read/write, backup/restore, export, lifecycle, integrity and schema-contract functions.

Historical P28/P34 snapshots remain unchanged; P36 is the closure event.

## Remaining deficiencies

Four remain:

- **P34-D001** — leaked-password protection / Pro-plan security-cost decision;
- **P34-D004** — provider-native audit visibility decision;
- **P34-D006** — remediating while P25 waits for generation-3 refreeze and a fresh 24-hour burn-in;
- **P34-D007** — isolated stateful non-production environment / cost decision.

No production Auth/billing/logging/environment change is performed by P36 staging.

## 3. P24 historical validator correction

`private.platform_p24_post_upgrade_validation()` currently reports fail because it compares today's evolved application schema with the immutable upgrade-era application-surface snapshot.

Its underlying current controls still report P18 clean, P20 drift false, P21 pass, P22 pass, 11/11 cron active, 4042 successful cron executions and 0 failures in the observed 24h window, and zero blocking replication slots.

P36 does not rewrite the historical P24 evidence. The hosted upgrade remains historically attested as successful. P25 will use the next eligible active generation freeze for stability certification; the archived P16 freeze is no longer an activation source.

## 4. Operating-effectiveness activation

OE is currently `armed_waiting_new_stable_epoch`. It is **not active**.

The activation engine requires all of the following:

1. P25 has a currently eligible active burn-in generation;
2. the live epoch exactly matches that generation's freeze;
3. the active generation has reached its minimum completion time;
4. at least 12 successful healthy public samples span that active generation;
5. P18/P20/P21/P22 and cron health remain good;
6. P32 is at least `warn` or `enforce`;
7. P33 is the active canonical evidence process;
8. the control catalog is frozen for the evidence period;
9. the evidence-collection dry-run passes;
10. no critical deficiency is open and high deficiencies are remediated or formally dispositioned.

Those gates cannot pass while P25 is `refreeze_pending`; P32/P33 also remain staged.

## No retroactive evidence clock

The formal 30-day operating-effectiveness period is **not backdated** to the P16 migration, the quiet-window start, P25 freeze time, or earlier P34/P35 point-in-time evidence.

When the gate eventually passes, `scripts/p36-activate-oe.py` uses the successful readiness observation timestamp as the actual OE period start.

The internal dry-run minimum is 30 calendar days. The 90-day target remains a planning target for external-audit readiness, not an auditor-issued requirement.

## Read-only remediation retest

`scripts/p36-remediation-retest.sql` contains only SELECT/CTE evidence queries. It rechecks RLS/no-policy direct grants, authenticated SECURITY DEFINER design invariants, Diet ownership migration origin, and frozen release epoch identity.

No DDL or DML is part of the P36 remediation evidence query.

## Production boundary

P36 has executed the safe repository/control-state actions: the invalidated generation-2 freeze is preserved as historical evidence, future branches follow the current P25 refreeze-pending state, and evidence-based design/ownership dispositions remain recorded.

P36 has **not** upgraded Supabase, enabled paid Auth features, changed RLS, changed function grants, changed database functions, created a branch environment, changed logging, or started the OE period early.

## Activation status

P36 remains `staged_pending_p35`.

The next meaningful live milestone is a valid generation-3 freeze after the latest shared epoch has remained quiet for at least 60 minutes and a post-final-change encrypted backup is available.
