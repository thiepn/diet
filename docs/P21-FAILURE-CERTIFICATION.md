# P21 — Full Failure-Injection, Incident Response & Recovery Certification

Date: 2026-09-30. Browser release remains Web 2.0.3. Operations release: P21.0.

P21 certifies the complete P14–P20 production-hardening stack under controlled failures and adds an operator-only emergency write freeze.

## Certification result

Final production certification:

- 15 scenarios;
- 15 passed;
- 0 failed;
- readiness: pass;
- writes paused: false;
- destructive restore executed: false;
- destructive failure injection: false;
- P20 schema drift: false;
- recent Diet cron failures: 0;
- P21-specific security advisor findings: 0;
- P21-specific performance advisor findings: 0.

## Failure scenarios

The database certification exercises:

1. anonymous Diet API execution remains denied;
2. latest P15 snapshot verifies and produces a safe staged restore plan;
3. authenticated P16 consolidated reads return current owner data;
4. P17 owner export returns all 18 tables without secret material;
5. P18 integrity baseline remains clean;
6. invalid negative nutrition writes are rejected by PostgreSQL;
7. P19 same-request replay returns the committed result;
8. P19 same request ID with changed payload is rejected;
9. stale content writes remain conflict-rejected;
10. no P19 request remains stuck in started state;
11. emergency incident write freeze blocks mutations and rollback re-enables writes;
12. P20 detects a temporary schema mutation and rollback restores the fingerprint;
13. the certified schema is clean after the drift probe;
14. all six scheduled Diet recovery/readiness jobs are active;
15. operational status endpoints remain service-only.

All mutation and schema probes run inside rollback-contained PostgreSQL subtransactions.

## Emergency write freeze

P21 adds `private.diet_incident_control` and:

`private.diet_p21_set_write_freeze(boolean,text)`

The control is private/service-only. When enabled, `private.diet_p19_begin_mutation()` rejects every authenticated Diet mutation before the request ledger or mutation core executes.

The normal state is:

`writesPaused = false`

Enabling a freeze requires an operator reason.

This is intended for suspected corruption, unauthorized mutation, unsafe schema drift, or recovery windows. It is not a browser feature and cannot be toggled by normal authenticated users.

## Daily readiness

`diet-p21-readiness-daily` runs at **03:47 UTC**.

It is deliberately lightweight and does not run destructive failure injection. It checks:

- latest full failure-certification result;
- P15 snapshot failure count;
- P18 integrity status;
- P19 stuck-request count;
- P20 drift status;
- incident write-freeze state;
- expected Diet cron jobs;
- Diet cron failures from the prior 24 hours.

Readiness/certification evidence is retained for 365 days in `private.diet_incident_certifications`.

## Monitoring repair

The old hourly monitor was still coupled to the original P13 cache namespace. P21 replaces this assumption with a version-aware monitor that reads the expected service-worker cache from the checked-out production source and verifies that the same release is deployed.

This prevents the monitoring system itself from generating false incidents after legitimate PWA releases.

## Incident response runbook

See `docs/P21-INCIDENT-RUNBOOK.md`.

The governing principles are:

- freeze writes before making an integrity incident worse;
- preserve evidence;
- do not automatically repair corrupted nutrition records;
- do not create a new request ID after an ambiguous write response;
- use P15 verified restore planning rather than ad-hoc destructive SQL;
- require P18 integrity clean + P20 fingerprint clean + P21 certification pass before ending a recovery window;
- never restore a deliberately deleted account from historical backup artifacts.

## Recovery certification

The latest P15 recovery snapshot is cryptographically and structurally valid, its row counts match current production at certification time, and its restore plan remains operator-reviewed.

P21 does not execute a destructive production restore. The purpose is to prove the recovery material and runbook are ready without risking healthy production data.
