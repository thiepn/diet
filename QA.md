# Diet Copilot 2.0.3 — P20 change-governance gates

Date: 2026-09-30.

| Gate | Coverage |
| --- | --- |
| CI | P13–P19 regressions plus P20 schema-governance contract |
| A7 | complete production hardening stack through P20 |
| A8 | Google-only Account consumer contract under P20 operations metadata |
| A9 | Account Platform v1 consumer release remains Web 2.0.3 |
| P20 static | deterministic schema contract, checkpointing, drift audit, 365-day retention, no auto-repair |
| P20 public probe | publishable/anonymous client cannot execute release-status endpoint |
| Live DB | expected/current fingerprint match; drift=false; latest audit clean |
| Rollback probe | temporary schema change detected and exact fingerprint restored after rollback |
| Cron | exactly one daily 03:37 UTC schema-drift audit |
| Advisors | no P20-specific security or performance finding |
| P14–P19 | all previous production hardening contracts remain green |

## P20 invariants

- Certified fingerprint is a 64-character SHA-256 digest.
- Contract scope is Diet-only and excludes unrelated shared-project applications.
- Current production fingerprint must equal the latest certified checkpoint.
- Release checkpoint status is clean.
- Drift detection must detect an actual catalog change.
- Rollback must restore the exact certified fingerprint.
- Schema drift is never auto-repaired.
- Checkpoint/audit state is private and inaccessible to browser roles.
- Release-status RPC is service-role only.
- Audit history is retained for 365 days.
- Browser/PWA remains Web 2.0.3 with the existing P17 cache namespace.
