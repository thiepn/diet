# Diet Copilot 2.0.3 — P22 long-term operability gates

Date: 2026-09-30.

| Gate | Coverage |
| --- | --- |
| CI | complete P13–P22 regression stack |
| A7 | production hardening stack through P22 |
| A8 | Google-only Account consumer contract under P22 metadata |
| A9 | Account Platform v1 consumer release remains Web 2.0.3 |
| P22 database | weekly maintenance audit, scheduler health, scoped cron-history cleanup |
| P22 supply chain | immutable Action SHAs, allowlist, vendor SHA-256, no remote runtime scripts/imports |
| Dependabot | weekly reviewed GitHub Action update PRs |
| P22 upstream watch | monthly Action-tag and Supabase JS version review |
| P22 public boundary | maintenance status remains service-only |
| P21 regression | 15/15 controlled failures still pass with seven Diet jobs |
| P20 | certified P22 schema fingerprint clean |
| P18 | integrity remains clean |
| Advisors | zero P22-specific security/performance findings |
| Pages | stable Web 2.0.3 artifact still deploys |

## P22 invariants

- Browser release remains 2.0.3.
- Operations release is P22.0.
- All external GitHub Actions use immutable 40-character SHAs.
- Every Action is reviewed in `supply-chain.lock.json`.
- Vendored Supabase JS 2.116.0 matches its locked SHA-256.
- Production browser code has no remote script or remote ESM dependency.
- Dependency updates are reviewed, not automatically deployed.
- Seven expected Diet database jobs are active.
- pg_cron scheduler is running.
- Diet cron history retention is 90 days.
- P22 maintenance evidence retention is 730 days.
- Cron cleanup cannot delete unrelated applications' history.
- P22 maintenance RPC is service-only.
- P18 integrity is clean.
- P20 drift is false.
- P21 readiness is pass.
- PostgreSQL 17.11 Diet preflight is clean.
- Shared-project Postgres upgrades remain manual and require cross-app review.
