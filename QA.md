# Diet Copilot 2.0.3 — P23 shared-platform upgrade-readiness gates

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
