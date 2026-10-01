# P24 — Manual Upgrade Handoff — COMPLETED

The manual Supabase **Upgrade project** action has been completed.

## Final outcome

- pre-upgrade build: `17.6.1.127`
- post-upgrade build: `17.6.1.164`
- release channel: `ga` → `preview`
- database restart: `2026-10-01T07:54:44.803638Z`
- raw PostgreSQL server: `17.6`
- P24 post-upgrade validation: **pass**
- current semantic schema SHA: `c6a7b8788a3798e3fe119007e55f7d1b5796ece574a27dd10abeb600179a9918`
- P18/P20/P21/P22: **clean / no drift / pass / pass**
- cron: **8/8 active**
- blocking replication slots: **0**
- application surface counts: **match**
- cross-app read smoke: **pass**

There is no remaining P24 manual action.

PostgreSQL 17.11 remains a separate compatibility/security baseline because the hosted Supabase build still reports PostgreSQL 17.6.

The active operations phase is now **P25 — Post-Upgrade Burn-In, Stability & Shared-Platform Production Certification**.
