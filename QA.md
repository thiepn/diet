# Diet Copilot 2.0.3 — P18 data-integrity gates

Date: 2026-09-29.

| Gate | Coverage |
| --- | --- |
| CI | P13–P17 regressions plus P18 integrity contract |
| A7 | combined operations/security/resilience/performance/privacy/integrity invariants |
| A8 | Google-only Account consumer contract under P18 operations metadata |
| A9 | Account Platform v1 consumer release remains Web 2.0.3 |
| P18 static | nine DB constraints, 17 checks, private ledger, service-only report, no auto-repair |
| P18 public probe | publishable/anonymous client cannot execute global integrity report |
| Live DB | clean 17-check release audit, nine validated constraints, negative-write rejection |
| Cron | exactly one daily 03:17 UTC integrity watchdog |
| Advisors | no P18-specific security or performance finding |
| P14 | security/public-boundary regression |
| P15 | backup/resilience regression |
| P16 | performance/owner-read regression |
| P17 | privacy/lifecycle regression |

## P18 invariants

- Nine P18 database CHECK constraints remain validated.
- Stored calories/macros and required targets cannot enter objectively invalid negative/non-positive states covered by P18.
- Uncertainty ranges cannot invert or exclude their stored calorie estimate.
- Global integrity auditing is service/internal-only.
- Audit history remains private and retained for 180 days.
- The watchdog runs daily at 03:17 UTC.
- Integrity auditing never auto-repairs or deletes Diet records.
- Release audit status must remain clean at certification time.
- UTC timestamp differences are not treated as Diet-day corruption.
- Same-day goal-phase transition boundaries are not treated as overlap corruption.
- Web/PWA remains 2.0.3; P18 does not cause service-worker churn.
