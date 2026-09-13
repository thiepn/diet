# A6 — Production Certification & Legacy Removal

**Consumer:** Diet Copilot  
**Date:** 2026-09-13  
**Branch:** `a6-production-certification`  
**Implementation state:** Implemented; certification validation in progress

## Final account contract

Diet Copilot uses the shared THIEPN Account Supabase project and the canonical browser auth key:

`sb-hycegznamzjhwinegaai-auth-token`

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

The repository CI verifies:

- JavaScript syntax.
- Shared THIEPN Account project is configured.
- Retired Diet auth project is absent from the production auth files.
- Shared storage key is used.
- Google and email/password entry points remain present.
- No app-specific `setSession()` token recovery path exists.
- No duplicate access/refresh-token backup is written.
- Targeted deletion of the retired localStorage/IndexedDB artifacts remains present.
- The retired UI recovery hook cannot silently return.

## Production/manual certification matrix

These checks require a deployed production origin, real authentication provider, multiple browser contexts/devices, or destructive account operations. They are intentionally not represented as passed by repository CI.

| Check | Status |
| --- | --- |
| Existing THIEPN Account restores in Diet Copilot | PENDING MANUAL |
| Google sign-in and callback | PENDING MANUAL |
| Email/password sign-in | PENDING MANUAL |
| Sign-out propagates as expected across supported THIEPN apps/tabs | PENDING MANUAL |
| Expired/revoked session recovery | PENDING MANUAL |
| Offline vs signed-out state remains distinguishable | PENDING MANUAL |
| Multi-device password/security change behavior | PENDING MANUAL |
| Account deletion invalidates access and preserves deletion policy | PENDING MANUAL |
| Chromium production smoke test | PENDING MANUAL |
| Firefox production smoke test | PENDING MANUAL |
| Safari/WebKit production smoke test | PENDING MANUAL |

## Security findings

### Resolved in A6

Diet Copilot previously maintained an app-specific recoverable copy of the THIEPN Account access and refresh tokens in localStorage/IndexedDB. This duplicated authentication authority and could rehydrate credentials independently of the canonical Supabase session store. A6 removes the recovery mechanism and deletes only those retired artifacts.

### Remaining validation

Production provider settings, callback allowlists, revocation behavior, account deletion, and multi-device behavior require live validation.

## Consumer rules

Diet Copilot may read normalized THIEPN Account state and use the authenticated UUID for Diet data. It must not own passwords, invent canonical user IDs, maintain a second canonical profile/session, or reconstruct the central session from app-specific token storage.

## Verdict

**NOT CERTIFIED — automated CI and manual production validation must both complete.**

Do not change this verdict to `CERTIFIED` until every required automated gate is green and the applicable production/manual matrix has been executed with no unresolved critical/high finding.
