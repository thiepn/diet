# P14 — Production Security, Authorization & Database Hardening

Date: 2026-09-29. Canonical backend: `hycegznamzjhwinegaai`.

## Result

P14 hardens the existing Diet Copilot write architecture without replacing it. The browser still has owner-scoped SELECT access and performs all mutations through the explicit `diet_app_*` RPC boundary.

## Database enforcement

Diet-owned public tables now have three independent ownership layers:

1. **RLS:** existing owner SELECT policies plus a P14 restrictive `FOR ALL` owner guard.
2. **Session-owner trigger:** every INSERT/UPDATE/DELETE on a Diet table rejects anonymous sessions and rejects rows whose `user_id` differs from the authenticated JWT owner. Service-role/admin operations without a user JWT remain available for trusted backend operations.
3. **Ownership-coupled foreign keys:** parent/child relationships include `user_id`, preventing a privileged-function bug from constructing cross-user Diet relationships.

The trigger applies to profiles, logs, meals/items, weights, goals, food/meal memory, recommendations, activity, training, audit/change history, weekly reviews and native-device records.

## Grant model

- `anon`: no Diet table privileges and no `diet_app_*` execution.
- `authenticated`: owner-scoped table SELECT only; no direct INSERT/UPDATE/DELETE; EXECUTE on the explicit `diet_app_*` write RPCs.
- `service_role`: trusted backend/private-helper path.
- Public RPCs use an empty `search_path` and explicitly bind operations to `auth.uid()`.
- Private helpers are not executable by `anon` or `authenticated`, and the private schema has no usage/create privilege for those roles.

## Production validation

Before migration, all checked owner relationships had zero mismatches. The applied constraints were validated successfully.

A rollback-only production probe then verified:

- a normal authenticated `diet_app_log_meal` call succeeds;
- a cross-user row write fails with `Diet row ownership mismatch`;
- an anonymous authenticated-role session fails with `Anonymous Diet access is not permitted`.

The entire probe transaction was rolled back.

## Advisor status

P14 removed the Diet-specific RLS-initplan and unindexed-FK findings introduced during hardening. The remaining Supabase `authenticated_security_definer_function_executable` warning for `diet_app_*` is an **intentional reviewed exception**: authenticated execution is the product's explicit write API, while PUBLIC/anon execution is revoked, wrappers check `auth.uid()`, and the table-level trigger independently enforces owner identity.

Supabase references:

- SECURITY DEFINER advisor: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- RLS policy guidance: https://supabase.com/docs/guides/database/postgres/row-level-security
- Unindexed FK advisor: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

The shared-project leaked-password warning is not a Diet password-auth vulnerability because Diet exposes Google OAuth only. It should be revisited if password authentication is introduced anywhere that materially affects the shared account security model.

## Migrations

- `20260929190638_diet_p14_security_authorization_hardening.sql`
- `20260929190758_diet_p14_advisor_performance_hardening.sql`
