# Diet Copilot

**Web 2.0.3 · P20 production change-governance hardening**

Diet Copilot 2.0 remains live at **https://thiepn.dev/diet/**. P20 is an operations-only release that detects silent production schema drift and records certified Diet database checkpoints.

## P20

Diet now has a deterministic SHA-256 schema contract covering its **18 public data tables**, **5 private operational tables**, columns, constraints, indexes, RLS policies, triggers, Diet functions and Diet cron jobs.

The certified P20 fingerprint is:

`f5463a8b37e3a0be94c15588037405bbcca75a5f60c5401f0c937b8e5dc13752`

A private daily watchdog runs at **03:37 UTC** and compares production with the latest certified release checkpoint. Audit results are retained for **365 days**.

P20 was fault-tested with a temporary unapproved schema constraint: drift was detected, rollback restored the exact fingerprint, and no probe change persisted.

The watchdog deliberately does **not auto-repair** production. Intentional schema changes should remain version-controlled migrations and receive a new checkpoint only after tests and advisors pass.

The contract excludes Supabase-managed auth/storage schemas and unrelated THIEPN apps, avoiding false alerts in the shared Supabase project.

## Existing protection

- **P13:** local-only operational telemetry and degraded-mode reliability.
- **P14:** authorization/RLS hardening.
- **P15:** verified snapshots and encrypted off-site backups.
- **P16:** production read/performance hardening.
- **P17:** authoritative export and lifecycle privacy.
- **P18:** database integrity constraints and corruption detection.
- **P19:** transactional idempotency and multi-device write serialization.

## Release

- Web/PWA: **2.0.3**
- Operations: **P20.0**
- Security: **P14**
- Resilience: **P15**
- Performance: **P16**
- Privacy/lifecycle: **P17**
- Data integrity: **P18**
- Concurrency/idempotency: **P19**
- Change governance/schema drift: **P20**

See [P20 change governance](docs/P20-CHANGE-GOVERNANCE.md) and [QA.md](QA.md).
