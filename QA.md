# Diet Copilot 2.0.3 — P17 privacy and lifecycle gates

Date: 2026-09-29.

| Gate | Coverage |
| --- | --- |
| CI | P13/P14/P15/P16 regressions plus P17 privacy/lifecycle contract |
| A7 | combined operations/security/resilience/performance/privacy invariants |
| A8 | Google-only Account consumer contract |
| A9 | Account Platform v1 consumer release 2.0.3 |
| P17 static | authoritative 18-table export, secret exclusions, local purge, central deletion boundary |
| P17 public probe | publishable/anonymous client cannot invoke owner export |
| Live DB | authenticated 18-table export, 281 current rows, invoker security, lifecycle cascade status |
| P14 | security/public-boundary regression |
| P15 | backup and resilience regression |
| P16 | performance and owner-read regression |
| Advisors | no new P17-specific security/performance defect |

## P17 invariants

- Complete JSON export requires a live authenticated owner session.
- Complete export covers all 18 Diet-owned tables.
- No auth/OAuth token or native credential digest is exported.
- Private P15 recovery snapshots are not exposed to the owner export.
- Diet browser code cannot invoke `delete_thiepn_account`.
- Central Account Platform deletion remains authoritative.
- All 18 live Diet tables cascade from `auth.users`.
- In-database recovery snapshots cascade from `auth.users`.
- Encrypted off-site recovery copies have a disclosed 90-day retention window.
- “Clear this device” affects local Diet state only and leaves cloud nutrition data untouched.
- P14 security, P15 resilience and P16 performance contracts remain green.
