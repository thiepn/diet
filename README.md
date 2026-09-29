# Diet Copilot

**Web 2.0.3 · P18 production data-integrity hardening**

Diet Copilot 2.0 remains live at **https://thiepn.dev/diet/**. P18 is a backend/operations release: it adds database constraints and an automated integrity watchdog without changing browser behavior or nutrition calculations.

## P18

P18 adds nine validated PostgreSQL constraints that reject objectively invalid nutrition states before they can become stored data. They cover logged meals/items, reusable foods/meals, targets and adaptive recommendation metadata.

A private integrity watchdog now checks **17 invariants** across ownership, aggregate totals, active phases, recommendation state, numeric validity and account-deletion cascade structure.

The first production P18 release audit is **clean: 17 checks, 0 failures, 0 warnings**.

The watchdog runs every day at **03:17 UTC** and stores audit results for 180 days in a private RLS-protected ledger. The operational report is available only to the service role; neither anonymous nor authenticated browser clients can execute it.

P18 deliberately has **no auto-repair**. If corruption is detected, the audit reports it and P15 recovery tooling remains the controlled recovery path.

Two exploratory signals are deliberately excluded from corruption rules: UTC-vs-local meal timestamps and same-day goal-phase transition boundaries. Both can be valid under Diet's existing semantics.

## Existing protection

- **P13:** local-only operational telemetry and degraded-mode reliability.
- **P14:** owner RLS, owner triggers, owner-coupled FKs and RPC authorization.
- **P15:** verified recovery snapshots and encrypted off-site backups.
- **P16:** consolidated owner reads, explicit owner filtering and performance budgets.
- **P17:** authoritative owner export, local-device purge and lifecycle hardening.

## Release

- Web/PWA: **2.0.3**
- Operations: **P18.0**
- Security: **P14**
- Resilience: **P15**
- Performance: **P16**
- Privacy/lifecycle: **P17**
- Data integrity: **P18**

See [P18 data-integrity hardening](docs/P18-DATA-INTEGRITY.md) and [QA.md](QA.md).
