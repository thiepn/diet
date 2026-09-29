# Diet Copilot

**Web 2.0.1 · P14 production security hardening**

Diet Copilot 2.0 remains the production nutrition tracker at **https://thiepn.dev/diet/**. P14 is a backend/security release: the browser bundle stays at Web 2.0.1 while the canonical Supabase authorization model gains additional database-level owner enforcement.

## P14 security model

Diet Copilot now has layered authorization:

- authenticated users have **owner-scoped SELECT only** on Diet tables;
- browser INSERT/UPDATE/DELETE remains denied;
- all browser mutations stay inside the explicit `diet_app_*` RPC boundary;
- `anon` has no Diet table access and no Diet write-RPC execution;
- a P14 restrictive RLS policy constrains every Diet table to the authenticated owner;
- a table-level session-owner trigger independently blocks anonymous writes and cross-user row writes, including mistakes inside privileged functions;
- composite owner foreign keys prevent cross-user parent/child references;
- public Diet RPCs keep `PUBLIC`/anon execution revoked and use an empty `search_path`;
- private helpers remain unavailable to browser roles.

The authenticated `SECURITY DEFINER` RPC pattern is intentional. It is retained because direct table DML is deliberately unavailable to the browser; P14 adds independent owner enforcement underneath those RPCs instead of weakening the boundary.

## Reliability and privacy

P13 reliability protections remain active:

- local-only sanitized operational telemetry;
- System Health diagnostics;
- foreground revalidation;
- uncertain-write blocking;
- Realtime/PWA diagnostics;
- hourly synthetic production monitoring.

Telemetry still excludes nutrition records, meal names, weights, account email, auth tokens, OAuth codes, request IDs, Copilot messages and free-form user content.

## Production and rollback

- `/diet/` — canonical Diet Copilot 2.0 production surface.
- `/diet/v2/` — stable compatibility alias.
- `/diet/legacy-v1.html` — independently sign-in-capable V1 rollback.
- `/diet/sw.js` — P13 production service worker, unchanged by the backend-only P14 release.

## Verification

```bash
node tests/p13-telemetry.mjs
node tests/p14-security-contract.mjs
python -m py_compile tests/p14-public-security-probe.py
python tests/p14-public-security-probe.py
```

P14 production verification also includes transactional rollback probes against the live database: valid authenticated RPC writes succeed, while cross-owner and anonymous writes are rejected.

See [P14 security hardening](docs/P14-SECURITY-HARDENING.md), [P13 operations](docs/P13-OPERATIONS.md), and [QA.md](QA.md).
