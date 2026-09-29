# P21 Incident Response Runbook

## Severity

**SEV-1** — suspected cross-owner access, unauthorized mutation, data corruption, unsafe schema drift, or recovery procedure actively required.

**SEV-2** — write failures, repeated ambiguous responses, cron failures, export/read degradation, or authentication/backend outage without evidence of corrupted stored data.

**SEV-3** — isolated browser/PWA issue with healthy backend and no data-risk signal.

## First actions

For SEV-1, stop mutation before diagnosis:

```sql
select private.diet_p21_set_write_freeze(
  true,
  'SEV-1: <short operator reason>'
);
```

Then collect, without repairing:

```sql
select public.diet_p21_incident_status();
select private.diet_p21_readiness_report();
select private.diet_p18_integrity_report();
select public.diet_p19_concurrency_status();
select public.diet_p20_release_status();
select private.diet_p15_status();
```

Do not expose service-role credentials to a browser or client device.

## Ambiguous write / lost HTTP response

1. Do **not** generate a new request ID.
2. Retry with the exact original request ID and payload.
3. P19 returns the committed result if the original transaction succeeded.
4. If the client uncertain-write guard is active, refresh/reconcile before allowing a different write.
5. If the same request ID is accidentally reused for a changed operation/payload, treat the collision rejection as correct behavior.

## Stale multi-device edit

A conflict means the server row changed after the client loaded it.

1. Refresh authoritative cloud data.
2. Present/review the newer state.
3. Reapply the intended user change explicitly.
4. Do not bypass `expected_updated_at` and do not auto-merge content edits.

## Backend/Auth outage

Expected client behavior:

- keep the user’s cached private read model where already available;
- do not treat a network failure as an explicit logout;
- prevent unsafe new writes while connectivity/state is uncertain;
- restore normal refresh after reconnect.

Check Supabase Auth health and project observability before changing data.

## Integrity failure

If P18 returns warning/critical or a database constraint begins rejecting previously valid operations:

1. enable the P21 write freeze;
2. preserve the P18 report and relevant Postgres logs;
3. verify the latest P15 snapshot;
4. compare current state with the snapshot restore plan;
5. identify the responsible release/mutation;
6. repair through a reviewed migration or P15 recovery procedure;
7. rerun P18, P20 and P21 certification before unfreezing writes.

Do not make silent bulk fixes merely to turn the watchdog green.

## Schema drift

If P20 reports drift:

1. enable write freeze when the drift can affect data correctness/security;
2. identify the exact catalog change and whether it corresponds to a reviewed migration;
3. never certify an unexplained fingerprint;
4. if accidental, revert through a reviewed migration;
5. if intentional, run all release gates/advisors and certify the new release checkpoint;
6. rerun P21 failure certification.

## Recovery snapshot / restore

Before any destructive restore:

1. require a maintenance window and write freeze;
2. run `private.diet_p15_verify_snapshot(snapshot_id)`;
3. run `private.diet_p15_restore_plan(snapshot_id)`;
4. confirm `safe_to_stage=true`;
5. confirm owner/table row counts and scope;
6. keep native device credential digests excluded;
7. follow the operator-reviewed P15 restore procedure.

After restore:

1. run P18 integrity audit;
2. run P20 schema drift audit;
3. run P21 full failure certification;
4. confirm no stuck P19 requests;
5. confirm application reads/exports;
6. only then disable the write freeze.

## Disable write freeze

After the incident is resolved and all certification gates are green:

```sql
select private.diet_p21_set_write_freeze(false,null);
```

Immediately confirm:

```sql
select public.diet_p21_incident_status();
select private.diet_p21_run_readiness_audit('manual');
```

## Cron incident

Inspect `cron.job` and `cron.job_run_details`.

Diet schedule:

- 02:17 UTC — P15 daily recovery snapshot
- 02:47 UTC day 1 — P15 monthly snapshot
- 03:17 UTC — P18 integrity audit
- 03:27 UTC — P19 request-ledger pruning
- 03:37 UTC — P20 schema-drift audit
- 03:47 UTC — P21 readiness audit
- 04:17 UTC — GitHub Actions encrypted off-site backup

If the pg_cron scheduler is not active, follow current Supabase pg_cron troubleshooting guidance rather than manually editing cron tables.

## Account deletion

Never restore a deliberately deleted THIEPN Account from P15/P21 recovery artifacts. Live Diet rows and in-database recovery snapshots cascade with central account deletion; encrypted off-site artifacts expire according to their retention policy and are not an active account source.
