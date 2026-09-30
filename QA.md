# Diet Copilot 2.0.3 — P23 active / P24 controlled-upgrade preflight gates

Date: 2026-09-30.

| Gate | Coverage |
| --- | --- |
| CI | complete P13–P23 static regression stack |
| A7 | P23 shared-platform readiness + prior production hardening |
| A8 | Google-only Account consumer contract under P23 operations metadata |
| A9 | Account Platform v1 consumer release remains Web 2.0.3 |
| P23 database preflight | all 17.11 hazards and shared infrastructure state |
| P23 shared fingerprint | app-owned relations/functions/policies/indexes/triggers/cron |
| P23 Edge inventory | 11 deployed Edge Function version/hash snapshots |
| P23 public probe | Auth + platform-health + service-only P23 RPC boundary |
| P21 regression | controlled-failure and cross-browser suite remains green |
| P22 regression | maintenance and supply-chain controls remain green |
| Advisors | zero P23-specific security/performance findings |
| P24 execution gate | exact schema certification + 10-minute migration quiet window |
| P24 recovery | fresh verified snapshot + successful encrypted off-site backup |
| P24 public boundary | service-only execution status remains inaccessible to browser clients |
| Pages | Web 2.0.3 deployment remains unchanged |

## P23 readiness invariants

- Browser release remains 2.0.3.
- Operations release is P23.0.
- Current PostgreSQL is 17.6.
- Target PostgreSQL is 17.11.
- P23 preflight status is pass.
- `safeToScheduleUpgrade=true`.
- The actual infrastructure upgrade has not been executed.
- Post-upgrade validation is pending.
- Shared schema fingerprint is `aa4aede72f4d2b3ae75b581f691ee6fa1c993a71279c836a8e1fe9b967e13e64`.
- Five registered Account apps are represented.
- Ten application/service surfaces plus one platform-control surface are fingerprinted.
- Eleven Edge Functions are inventoried externally.
- Eight cron jobs are active.
- pg_cron scheduler is alive.
- Recent cron failures are zero.
- ltree index hazards are zero.
- btree_gist float-index hazards are zero.
- affected custom operators are zero.
- legacy pgcrypto cipher references are zero.
- app-owned reg* columns are zero.
- deprecated PG17 extensions are zero.
- extension version mismatches are zero.
- MD5 login roles are zero.
- logical replication slots are zero.
- Diet P18 integrity remains clean.
- Diet P20 drift remains false.
- Diet P21 failure/readiness remains pass.
- Diet P22 maintenance remains pass.
- P23 status RPC is service-only.
- The Diet P20 checkpoint intentionally remains P22 because P23 has its own broader cross-app fingerprint.


## P24 ready-for-manual-execution invariants

- Active operations release remains P23.0 until the managed upgrade completes.
- P24 remains incomplete, but its execution gate is now `ready_for_manual_upgrade`.
- PostgreSQL remains 17.6 until the Dashboard upgrade.
- Target remains 17.11.
- Managed upgrade execution is not available through the connected automation surface.
- Pause/Restore is not used as a substitute for the recommended in-place upgrade.
- Shared schema SHA is `f5485033a2845f9a1baacee6811c976c72e5ffb5d73bf0b9a50e3d0c0b48647c`.
- The execution gate requires the SHA to match the latest passing P23 certification.
- The database quiet window is satisfied and the current certified schema SHA matches exactly.
- Diet writes are currently not paused.
- A fresh P15 recovery snapshot is verified and safe to stage.
- The latest encrypted off-site backup run succeeded.
- P24 is not complete until PostgreSQL 17.11+ and post-upgrade cross-app validation pass.

- Final Edge Function inventory recheck is mandatory because Edge deployments are outside the PostgreSQL schema fingerprint.
- The Edge Function quiet window is satisfied against the current v21 Gomoku room deployment, and must be rechecked immediately before the Dashboard click.
