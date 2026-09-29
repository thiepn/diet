# P22 PostgreSQL & Platform Upgrade Playbook

## Current baseline

At P22 certification:

- project PostgreSQL: **17.6**
- Supabase security baseline under review: **17.11**
- Diet-specific 17.11 preflight: **clean**
- shared-project review: **required**

## Before a Supabase Postgres upgrade

1. Confirm P15 encrypted off-site backup and latest in-database snapshot are healthy.
2. Confirm P18 integrity is clean.
3. Confirm P20 schema drift is false.
4. Confirm P21 failure certification/readiness is green.
5. Confirm P22 maintenance status is pass.
6. Review all other THIEPN apps in this shared Supabase project for the 17.11 changes.
7. Specifically check for:
   - `ltree` indexes;
   - `btree_gist` float indexes with possible NaN;
   - pgcrypto PGP values using Blowfish/CAST5;
   - custom operators with non-built-in selectivity estimators.
8. Choose a maintenance window. Do not treat a production database upgrade as an ordinary Diet deploy.

## During maintenance

If data risk exists, enable the P21 Diet write freeze before the database maintenance window.

Use the Supabase Infrastructure upgrade flow rather than ad-hoc extension/version SQL. P22 intentionally does not automate shared-project infrastructure upgrades.

## After upgrade

Run, in order:

1. P15 snapshot verification / restore readiness.
2. P18 integrity audit.
3. P20 schema drift audit.
4. P21 full failure certification.
5. P21 readiness audit.
6. P22 maintenance audit.
7. public production matrix.
8. Chromium, Firefox and WebKit live regression when the platform change could affect browser behavior.

Only disable an incident write freeze after all relevant gates return green.

## pg_cron

Supabase documents that `cron.job_run_details` does not clean itself automatically. P22 therefore keeps only 90 days of current Diet-job history while leaving unrelated shared-project history untouched.

Never update `cron.job` rows directly. Use `cron.schedule`, `cron.alter_job` and `cron.unschedule`.
