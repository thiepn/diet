# P17 — Privacy, Data Lifecycle & Account-Deletion Hardening

Date: 2026-09-29. Browser release: Web 2.0.3.

P17 makes Diet's data-export and local-device privacy behavior match the production backend rather than the limited browser read model.

## Authoritative owner export

The previous "Full JSON backup" was built from whatever subset of Diet data happened to be loaded in the browser. That omitted several Diet-owned tables and intentionally limited some history for normal UI performance.

P17 replaces it with the authenticated `diet_app_export_owner_data()` RPC. The export covers all 18 Diet-owned tables at the moment the export is requested.

The RPC is:

- `SECURITY INVOKER`;
- available to `authenticated` and `service_role`, not `anon`;
- explicitly bound to `auth.uid()`;
- rejected for anonymous Supabase Auth identities;
- still governed by P14 RLS;
- not backed by a stale recovery snapshot.

The export intentionally excludes:

- access/refresh/provider tokens;
- OAuth credentials;
- `diet_native_devices.credential_digest`;
- private P15 recovery snapshots;
- local P13 operational telemetry;
- local UI preferences;
- session-only Copilot history.

The production validation on 2026-09-29 returned 281 current owner rows across all 18 tables with zero native credential digests.

## Account lifecycle

Diet does not implement its own browser account-deletion RPC.

The shared Account Platform already owns deletion through `delete_thiepn_account(text)`. P17 verifies that every one of the 18 Diet tables references `auth.users(id) ON DELETE CASCADE`, and that `private.diet_recovery_snapshots` does the same.

Therefore a successful central account deletion removes:

- live Diet application rows;
- Diet native-device records;
- in-database P15 recovery snapshots.

The Account Platform may still refuse account deletion for its own security/lifecycle reasons, such as required MFA assurance or remaining protected storage objects. Diet does not bypass those checks.

## Disaster-recovery retention

Encrypted P15 off-site GitHub artifacts are not an active account data source and cannot be selectively rewritten. Historical data can remain inside those encrypted artifacts until their configured 90-day retention expires.

P17 exposes this limitation in the data/privacy UI and in the owner export lifecycle metadata. Recovery procedures must never use an old artifact to reactivate a deliberately deleted account.

## Clear this device

P17 adds one explicit local purge action. After confirmation it:

1. clears the Diet offline nutrition cache;
2. removes Diet auth/PKCE storage and OAuth relay remnants;
3. signs the local Diet session out;
4. clears the uncertain-write guard;
5. clears P13 local diagnostic history;
6. clears the session-only Copilot conversation;
7. removes Diet appearance preferences;
8. resets the current in-memory private Diet model.

It does **not** delete cloud nutrition records or the THIEPN Account.

Static PWA shell assets are public application code and are not treated as private user data.

## Export surfaces

- **Complete JSON export:** requires a live signed-in connection; authoritative 18-table cloud export.
- **Nutrition CSV:** generated locally from the currently loaded read model.
- **Weight CSV:** generated locally from the currently loaded read model.

The JSON button does not silently fall back to a partial cache when offline.

## P17 lifecycle audit

The private service-role-only `diet_p17_lifecycle_status()` function reports the structural lifecycle contract without exposing owner data. Production validation confirmed:

- 18 / 18 Diet tables cascade from `auth.users`;
- P15 recovery snapshots cascade from `auth.users`;
- central account-deletion RPC exists;
- Account Platform snapshot RPC exists;
- Diet owner-export RPC exists;
- encrypted off-site retention is 90 days.

## Non-goals

P17 does not:

- change adaptive nutrition calculations;
- add a Diet-specific cloud-data deletion path;
- add a browser account-delete button;
- weaken P14 RLS;
- alter P15 backup encryption;
- extend backup retention.
