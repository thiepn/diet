# Diet Copilot

**Web 2.0.2 · P16 production performance hardening**

Diet Copilot 2.0 remains live at **https://thiepn.dev/diet/**. P16 changes the signed-in read transport and query efficiency without changing nutrition calculations, coaching rules, or the visible product.

## P16

A normal Diet refresh previously used 12 separate Supabase reads. Web 2.0.2 now uses one owner-scoped `diet_app_read_snapshot()` RPC.

The RPC is `SECURITY INVOKER`, requires an authenticated non-anonymous account, uses explicit `auth.uid()` predicates, and remains governed by P14 RLS. The old multi-query loader is retained only as a `PGRST202` compatibility fallback, with explicit `user_id` filtering on every table.

Realtime INSERT/UPDATE subscriptions are owner-filtered. Broad DELETE subscriptions were removed because Supabase does not support row filters for DELETE Postgres Changes; Diet's delete actions already perform explicit refreshes and foreground revalidation remains active.

P16 refreshes planner statistics and enforces a 700 KB raw core asset budget. Three speculative ordering indexes were tested, flagged unused by the production advisor, and removed rather than adding unnecessary write overhead.

## Existing protection

- **P13:** local-only operational telemetry and degraded-mode reliability.
- **P14:** owner RLS, owner triggers, owner-coupled FKs and RPC authorization.
- **P15:** verified recovery snapshots and encrypted off-site backups.

## Release

- Web/PWA: **2.0.2**
- Operations: **P16.0**
- Security: **P14**
- Resilience: **P15**
- Performance: **P16**

See [P16 performance hardening](docs/P16-PERFORMANCE-HARDENING.md) and [QA.md](QA.md).
