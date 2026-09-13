# A6 — Production Certification & Legacy Removal

**Consumer:** Diet Copilot  
**Date:** 2026-09-13  
**Branch:** `a6-production-certification-current`  
**Implementation state:** Implemented; certification validation in progress

## Final account contract

Diet Copilot uses the shared THIEPN Account Supabase project and canonical browser auth key `sb-hycegznamzjhwinegaai-auth-token`.

Supabase session persistence/refresh is the only persisted auth authority. Diet Copilot must not keep a second recoverable copy of access or refresh tokens.

Ordinary Diet sign-out is explicitly browser/session-local (`scope: 'local'`). Security actions that intentionally revoke other sessions must remain separate, explicit operations.

## A6 legacy inventory and disposition

| Legacy artifact | A6 disposition |
| --- | --- |
| `diet-copilot-thiepn-auth-token-backup-v2` | Deleted with targeted cleanup; never restored |
| IndexedDB `diet-copilot-auth-vault` | Deleted with targeted cleanup; never restored |
| `clearDietAuthRecovery` UI hook | Removed |
| Retired Diet Supabase project `mrrqsqawwxwebsdmrnre` | No production code references; retained temporarily as rollback-only migration evidence until live certification completes |
| Shared THIEPN Account storage | Retained as the single session authority |
| Diet application/user data | Preserved |

No broad `localStorage.clear()` or equivalent data wipe is used.

## Migration integrity audit

A6 compared the retired Diet project with the canonical THIEPN Account project rather than assuming the A5 cutover was lossless.

The audit found a small cutover-window delta that had not reached the canonical project. The repair was applied atomically on 2026-09-13:

- restored one missing weight record;
- restored one missing meal and its six child items;
- restored the two matching action-history records;
- remapped ownership to the canonical THIEPN Account UUID;
- reused the existing semantically identical same-day canonical log instead of duplicating it;
- preserved newer post-cutover canonical records.

Post-repair source/destination semantic hashes match for the restored top-level records after excluding the intentionally remapped ownership/parent identifiers. The retired project is therefore kept intact as rollback evidence until deployment and live smoke validation complete; it is not an active application authority.

## Automated gates

Repository CI verifies JavaScript syntax, the shared THIEPN project/storage contract, absence of retired-project references, Google and email/password entry points, explicit local browser sign-out, absence of app-specific `setSession()` recovery, absence of duplicate token-backup writes, targeted deletion of retired auth artifacts, and absence of the retired UI recovery hook.

Latest A6 CI on the local-signout hardening head is green.

## Production/manual certification matrix

| Check | Status |
| --- | --- |
| Existing THIEPN Account restores in Diet Copilot | PENDING MANUAL |
| Google sign-in and callback | PENDING MANUAL |
| Email/password sign-in | PENDING MANUAL |
| Sign-out propagation across supported apps/tabs | PENDING MANUAL |
| Expired/revoked session recovery | PENDING MANUAL |
| Offline vs signed-out state | PENDING MANUAL |
| Multi-device security-change behavior | PENDING MANUAL |
| Account deletion behavior | PENDING MANUAL |
| Chromium production smoke test | PENDING MANUAL |
| Firefox/Zen production smoke test | PENDING MANUAL |
| Safari/WebKit production smoke test | PENDING MANUAL |

## Security findings resolved

1. Diet Copilot previously maintained an app-specific recoverable copy of THIEPN Account access and refresh tokens in localStorage/IndexedDB. A6 removes that duplicate persistence path and retains targeted cleanup only.
2. Diet's ordinary sign-out previously relied on Supabase JavaScript's default `signOut()` scope, which is global. A6 makes the intended current-browser/session behavior explicit with `scope: 'local'` and protects it with CI.
3. A6 detected and repaired the cutover-window data delta before legacy infrastructure removal.

## Consumer rule

Diet Copilot may consume THIEPN Account identity and use the authenticated UUID for Diet data. It must not own passwords, invent canonical user IDs, maintain a second canonical profile/session, or reconstruct the central session from app-specific token storage.

## Verdict

**NOT CERTIFIED — automated CI and manual production validation must both complete.**
