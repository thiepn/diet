# A6 — Production Certification & Legacy Removal

**Consumer:** Diet Copilot  
**Date:** 2026-09-13  
**Branch:** `a6-production-certification-current`  
**Implementation state:** Implemented; certification validation in progress

## Final account contract

Diet Copilot uses the shared THIEPN Account Supabase project and canonical browser auth key `sb-hycegznamzjhwinegaai-auth-token`.

Supabase session persistence/refresh is the only persisted auth authority. Diet Copilot must not keep a second recoverable copy of access or refresh tokens.

## A6 legacy inventory and disposition

| Legacy artifact | A6 disposition |
| --- | --- |
| `diet-copilot-thiepn-auth-token-backup-v2` | Deleted with targeted cleanup; never restored |
| IndexedDB `diet-copilot-auth-vault` | Deleted with targeted cleanup; never restored |
| `clearDietAuthRecovery` UI hook | Removed |
| Retired Diet Supabase project `mrrqsqawwxwebsdmrnre` | CI rejects references |
| Shared THIEPN Account storage | Retained as the single session authority |
| Diet application/user data | Untouched |

No broad `localStorage.clear()` or equivalent data wipe is used.

## Automated gates

The repository CI verifies JavaScript syntax, the shared THIEPN project/storage contract, absence of the retired project, Google and email/password entry points, absence of app-specific `setSession()` recovery, absence of duplicate token-backup writes, targeted deletion of retired auth artifacts, and absence of the retired UI recovery hook.

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

## Security finding resolved

Diet Copilot previously maintained an app-specific recoverable copy of THIEPN Account access and refresh tokens in localStorage/IndexedDB. A6 removes that duplicate persistence path and retains targeted cleanup only.

## Consumer rule

Diet Copilot may consume THIEPN Account identity and use the authenticated UUID for Diet data. It must not own passwords, invent canonical user IDs, maintain a second canonical profile/session, or reconstruct the central session from app-specific token storage.

## Verdict

**NOT CERTIFIED — automated CI and manual production validation must both complete.**
