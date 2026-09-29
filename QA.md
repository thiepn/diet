# Diet Copilot 2.0.3 — P21 failure, incident-response and recovery gates

Date: 2026-09-30.

| Gate | Coverage |
| --- | --- |
| CI | full P13–P21 static regression stack |
| A7 | complete production hardening stack through P21 |
| A8 | Google-only Account consumer contract under P21 operations metadata |
| A9 | Account Platform v1 consumer release remains Web 2.0.3 |
| P21 DB certification | 15 controlled failure scenarios, all passing |
| P21 write freeze | central mutation gateway rejects writes while incident freeze is enabled |
| P21 readiness | P15/P18/P19/P20/cron/freeze operational health |
| P21 public matrix | shell/Auth healthy; protected read/export/status RPCs deny publishable anonymous access |
| P21 browsers | Chromium, Firefox and WebKit offline/reconnect certification |
| P15 backup | encrypted off-site backup regression remains green |
| Advisors | zero P21-specific security/performance findings |
| P20 | final P21 schema fingerprint certified clean |
| Pages | stable Web 2.0.3 artifact still deploys |

## P21 invariants

- 15/15 database failure scenarios pass.
- No destructive restore is executed during certification.
- Failure injection leaves no probe mutation/schema change behind.
- Emergency write freeze is service-only and normally disabled.
- Write freeze blocks mutations before the P19 request ledger/core.
- Latest P15 snapshot verifies and restore plan is safe to stage.
- P18 integrity remains clean after all probes.
- P19 has zero stuck started requests after all probes.
- P20 fingerprint returns to the exact certified P21 value after drift injection.
- Six Diet database watchdog jobs are active.
- P21 readiness runs daily at 03:47 UTC.
- P21 evidence is private and retained for 365 days.
- Public/anonymous clients cannot access operational status endpoints.
- Browser/PWA remains Web 2.0.3 with the existing P17 cache namespace.
