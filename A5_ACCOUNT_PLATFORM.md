# A5 — Diet Copilot Account Platform Cutover

Diet Copilot now participates in the certified THIEPN Account platform contract while keeping its existing Supabase data client and Firefox/Zen recovery vault.

## Pinned contract

- Account SDK semantics: `1.2.0`
- Platform contract: `1.0.0`
- certified source SHA: `124221f39a932d50f9a86ad5c3da2d8fd1fe50af`
- app id: `diet`
- canonical session key: `sb-hycegznamzjhwinegaai-auth-token`

`dashboard-account-platform.js` is a local classic-script bridge. Diet does not runtime-load mutable account code from another application.

## Preserved architecture

`supabase-js` remains the OAuth/password/session-refresh/data/realtime engine. The A5 bridge adds only first-party platform semantics:

- A4 app-activity metadata
- A3 AAL/MFA handoff state
- version/source pins
- canonical THIEPN Account management link

Diet nutrition records remain Diet-owned and are not placed in the A4 platform snapshot.

## Firefox / Zen recovery vault

The existing recovery design is intentionally preserved:

1. Supabase reads the canonical shared session key.
2. If that is empty, Diet tries its same-project local/IndexedDB recovery copy.
3. A successfully restored session is persisted back into the recovery copy.
4. Transient `SIGNED_OUT` bootstrap events do **not** erase the vault.
5. Explicit user sign-out owns permanent recovery-vault deletion.

The IndexedDB database/store remain:

```text
diet-copilot-auth-vault / sessions
```

No password is stored in the vault.

## Script ordering

`dashboard-account-platform.js` loads synchronously before `dashboard-auth-persist.js`. This is a release invariant because an async bridge would create a startup race in browsers where Diet's recovery mechanism matters most.

## Security alignment

- Existing passwords can still sign in regardless of historical length.
- Newly created or changed passwords from Diet require at least 12 characters.
- Sign-out uses Supabase `scope: 'local'` and clears Diet's recovery vault.
- Accounts with verified MFA expose an account handoff state. Diet does not currently require AAL2 for nutrition data; protected account management is completed at `/account/`.

A5 deliberately does not turn on restrictive app-data AAL2 policies yet.

## Activity metadata

After a valid session is restored or refreshed, Diet best-effort upserts only its `account_user_apps` activity marker for app id `diet`.

Failure to write ecosystem metadata never blocks nutrition data, local cache, authentication, or realtime refresh. The live A4 RLS remains authoritative and requires `auth.uid()` ownership plus an active manifested app.

## Certification

The repository CI checks:

- JavaScript syntax for all root scripts
- Account SDK/platform/source pins
- parser ordering of the platform bridge before persistence
- canonical storage key
- no retired Supabase auth project
- no service-role/secret credentials
- recovery-vault invariants
- A4 activity integration
- MFA handoff state
- 12-character new/change password floor
- local-browser sign-out
- central THIEPN Account management handoff
