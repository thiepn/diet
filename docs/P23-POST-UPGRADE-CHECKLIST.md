# P23 — Post-Upgrade Validation Matrix

| Surface | Required validation |
| --- | --- |
| Shared Auth | /auth/v1/health healthy; existing Google sessions can refresh |
| THIEPN Account | app registry/data inventory/session APIs read successfully |
| Diet | P18 clean, P20 no drift, P21 15/15, P22 pass, normal snapshot read |
| Notes | sync access and workspace state read/write smoke |
| TMS60 | cloud state read plus backup inventory/restore contract |
| WTTN | save read/write/revision smoke |
| Wordstrike | profile sync plus leaderboard path |
| Gomoku | room create/join/presence/spectator path |
| Leaderboard | profile/read/submit service path |
| Micro Arcade | leaderboard start/result/read path |
| Canvas | load/edit/history/undo path |
| Edge Functions | all P23 inventory functions still ACTIVE; version/hash changes explained |
| Cron | all eight shared jobs active; scheduler alive; no upgrade-time failure residue |
| Database | P23 fingerprint match; no 17.11 hazard appears |
| Advisors | no new relevant security/performance issue |

A successful PostgreSQL version check without this matrix is insufficient for P23/P24 completion.
