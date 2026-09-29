# Diet Copilot 2.0.1 — P14 production security gates

Date: 2026-09-29. Phase: P14 Production Security, Authorization & Database Hardening.

## Required gates

| Gate | Coverage |
| --- | --- |
| CI | P13 telemetry privacy, P14 static security contract, release metadata and built Pages artifact |
| A7/P14 operations | degraded-mode/write safety plus P14 database-security metadata |
| A8 account consumer | Google-only PKCE, canonical project, shared auth storage and P14 operations metadata |
| A9 account platform | Account Platform v1 contract with Diet Web 2.0.1 |
| P14 public probe | publishable/anon key cannot read Diet tables or execute Diet write RPCs |
| Supabase catalog verification | RLS, grants, owner policies/triggers, RPC ACL/search path and validated P14 constraints |
| Transactional live probe | authenticated RPC works; cross-owner and anonymous writes fail; transaction rolls back |
| Supabase advisors | no P14 RLS-initplan or unindexed-FK findings |

## Authorization invariants

- `anon` has no Diet table privileges and no `diet_app_*` execution.
- `authenticated` has owner-scoped SELECT only on Diet tables.
- Browser mutations use only `diet_app_*` RPCs.
- Public write RPCs revoke `PUBLIC`/anon, grant authenticated only, and use an empty `search_path`.
- Every Diet-owned table has the restrictive `diet_p14_owner_guard` policy.
- Every Diet-owned table has the `diet_p14_session_owner_guard` trigger.
- Anonymous authenticated-role sessions are rejected.
- A privileged function cannot write a row owned by another authenticated user.
- Parent/child ownership is enforced with validated composite foreign keys.
- Private Diet helpers remain unavailable to `anon` and `authenticated`.

## Reviewed advisor exception

Supabase continues to flag authenticated `SECURITY DEFINER` Diet RPCs. For Diet this is intentional: these functions are the explicit write API required because direct table mutation is denied. The warning is accepted only while all compensating controls above remain green.

Reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## Shared-project findings outside P14 scope

Other apps in the shared Supabase project can still produce advisor findings. P14 does not alter unrelated leaderboard, arcade, Notes, or account objects. The shared leaked-password warning is not used by Diet's Google-only auth flow and should be reviewed separately if password authentication becomes part of the account model.
