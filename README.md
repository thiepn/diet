# Diet Copilot

**Web 2.0.3 · P21 full failure/recovery certification**

Diet Copilot 2.0 remains live at **https://thiepn.dev/diet/**. P21 certifies the complete P14–P20 production-hardening stack under controlled failure and adds an operator-only emergency write freeze.

## P21

The production database now has a **15-scenario failure certification** covering authorization denial, verified recovery material, authenticated reads/exports, integrity constraint rejection, exact idempotent replay, request-ID collisions, stale-write rejection, stuck-request detection, emergency write freeze, schema drift detection/rollback, scheduled watchdogs and service-only operations.

Final production result: **15 passed / 0 failed**.

P21 adds `private.diet_p21_set_write_freeze(...)`. When enabled by a trusted operator, the central P19 mutation gateway rejects new Diet writes before the request ledger or mutation core runs. The normal certified state is **writes paused = false**.

A lightweight readiness audit runs daily at **03:47 UTC** and checks P15 snapshots, P18 integrity, P19 stuck requests, P20 drift, write-freeze state, cron presence and recent cron failures. Evidence is retained privately for 365 days.

The old P13-era hourly monitor was also repaired: it now derives the expected PWA cache/release from the current repository rather than assuming the original P13 cache forever.

No destructive production restore is executed by P21. The latest P15 snapshot and restore plan are verified and ready for an operator-reviewed maintenance window if recovery is ever required.

## Production hardening stack

- **P13:** local-only operational telemetry and degraded-mode reliability.
- **P14:** authorization/RLS hardening.
- **P15:** verified snapshots and encrypted off-site backups.
- **P16:** production read/performance hardening.
- **P17:** authoritative export and lifecycle privacy.
- **P18:** database integrity constraints and corruption detection.
- **P19:** transactional idempotency and multi-device serialization.
- **P20:** certified schema fingerprint and drift detection.
- **P21:** failure injection, emergency write freeze, incident response and recovery certification.

## Release

- Web/PWA: **2.0.3**
- Operations: **P21.0**
- Security: **P14**
- Resilience: **P15**
- Performance: **P16**
- Privacy/lifecycle: **P17**
- Data integrity: **P18**
- Concurrency/idempotency: **P19**
- Change governance: **P20**
- Incident/recovery certification: **P21**

See [P21 failure certification](docs/P21-FAILURE-CERTIFICATION.md), [P21 incident runbook](docs/P21-INCIDENT-RUNBOOK.md), and [QA.md](QA.md).
