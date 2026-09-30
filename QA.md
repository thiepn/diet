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
- Shared schema fingerprint is `8239b32928be652214a63ae733d42bace71d46d7145e3e6e5eea8b7f066e1dfe`.
- Six registered Account apps are represented.
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
- blocking/custom logical replication slots are zero; managed temporary Realtime slots are tracked separately.
- Diet P18 integrity remains clean.
- Diet P20 drift remains false.
- Diet P21 failure/readiness remains pass.
- Diet P22 maintenance remains pass.
- P23 status RPC is service-only.
- The Diet P20 checkpoint intentionally remains P22 because P23 has its own broader cross-app fingerprint.


## P24 concurrency-safe execution invariants

- Active operations release remains P23.0 until the managed upgrade completes.
- P24 remains incomplete; its live execution gate may be `blocked` during concurrent shared changes and becomes `ready_for_manual_upgrade` only after re-certification plus the final quiet window.
- PostgreSQL remains 17.6 until the Dashboard upgrade.
- Target remains 17.11.
- Managed upgrade execution is not available through the connected automation surface.
- Pause/Restore is not used as a substitute for the recommended in-place upgrade.
- Current certified shared schema SHA is `8239b32928be652214a63ae733d42bace71d46d7145e3e6e5eea8b7f066e1dfe`.
- The execution gate requires the SHA to match the latest passing P23 certification.
- Final live gate status is `ready_for_manual_upgrade`: exact schema match, P23 preflight pass, and more than 10 minutes of database quiet time.
- Diet writes are currently not paused.
- A fresh P15 recovery snapshot is verified and safe to stage.
- The latest encrypted off-site backup run succeeded.
- P24 is not complete until PostgreSQL 17.11+ and post-upgrade cross-app validation pass.

- Final Edge Function inventory recheck is mandatory because Edge deployments are outside the PostgreSQL schema fingerprint.
- The latest recorded Gomoku room deployment is v27 and had more than 10 minutes of Edge quiet time at final certification; recheck immediately before the Dashboard click.

## P24 refresh evidence

- Gomoku P6/P7 and Account changes after the original handoff were detected rather than silently accepted.
- Latest recorded shared migration: `20260930164232_gomoku_p7_ranked_active_opponent_index`.
- Gomoku surface at the refresh: 9 relations / 8 functions.
- Latest recorded `gomoku-room`: v27 (`958f8595…db5068`).
- Fresh verified Diet recovery snapshot: `2026-09-30T20:27:39.582068Z`.
- Replication-slot classifier: 0 blocking slots at the latest refresh; managed Realtime slots are surfaced independently.

## Final P24 ready evidence

- Live execution gate: `ready_for_manual_upgrade`.
- Database quiet time at final check: 225.23 minutes.
- Edge quiet time at final capture: 185.63 minutes.
- Current/certified shared SHA: `8239b32928be652214a63ae733d42bace71d46d7145e3e6e5eea8b7f066e1dfe`.
- Latest shared migration: `20260930164232_gomoku_p7_ranked_active_opponent_index`.
- Latest `gomoku-room`: v27, SHA `958f85954b7b0e1fe01d67eafc01e6e25e9c216743a6c46ba0e695d218db5068`.
- Blocking replication slots: 0.
- P23 preflight: pass.
- Fresh P15 recovery snapshot: verified.
- Latest encrypted P15 off-site backup: run `36744693032`, success.
