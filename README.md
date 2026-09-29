# Diet Copilot

**Web 2.0.3 · P19 concurrency and idempotency hardening**

Diet Copilot 2.0 remains live at **https://thiepn.dev/diet/**. P19 is a backend/operations release: it hardens all authenticated mutations against duplicate delivery, cross-operation request-ID reuse, and simultaneous multi-device writes without changing the browser UI or nutrition logic.

## P19

All **18 authenticated write RPCs** now keep their existing public names/signatures but execute through a transactional request wrapper. Their previous implementations live as private mutation cores.

Each request ID is bound to the owner, exact operation, and SHA-256 of the canonical JSON payload:

- same ID + same operation + same payload → exact committed-result replay;
- same ID + changed payload → rejected;
- same ID + changed operation → rejected;
- failed transaction → claim rolls back with the mutation.

P19 also takes a transaction-scoped advisory lock per owner, so different mutations from multiple devices or tabs cannot execute concurrently.

Existing `expected_updated_at` checks remain authoritative for content-bearing edits and deletes. P19 does **not** auto-merge stale content. Favorite/unfavorite controls remain explicit state setters with deterministic serialized last-write-wins behavior.

The private request ledger retains replay data for **35 days**, is inaccessible to browser roles, cascades on account deletion, and is pruned daily at **03:27 UTC**.

Production certification reports **18 public wrappers, 18 private cores, 0 stuck requests**, with zero P19-specific Supabase security or performance advisor findings.

## Existing protection

- **P13:** local-only operational telemetry and degraded-mode reliability.
- **P14:** owner RLS, owner triggers, owner-coupled FKs and RPC authorization.
- **P15:** verified recovery snapshots and encrypted off-site backups.
- **P16:** consolidated owner reads, explicit owner filtering and performance budgets.
- **P17:** authoritative owner export, local-device purge and lifecycle hardening.
- **P18:** database integrity constraints and scheduled corruption detection.

## Release

- Web/PWA: **2.0.3**
- Operations: **P19.0**
- Security: **P14**
- Resilience: **P15**
- Performance: **P16**
- Privacy/lifecycle: **P17**
- Data integrity: **P18**
- Concurrency/idempotency: **P19**

See [P19 concurrency/idempotency hardening](docs/P19-CONCURRENCY-IDEMPOTENCY.md) and [QA.md](QA.md).
