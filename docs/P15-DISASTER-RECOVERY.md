# P15 — Backup, Disaster Recovery & Production Data Resilience

Date: 2026-09-29. Canonical backend: `hycegznamzjhwinegaai`.

## Recovery objectives

The shared THIEPN Account Supabase project is currently on the Free plan. Supabase-managed daily database backups are therefore not the P15 recovery mechanism. Diet Copilot uses two independent layers:

1. **Private in-database recovery snapshots** for logical corruption, bad application/database changes, or accidental Diet-row damage while the project remains available.
2. **Encrypted GitHub Actions artifacts** for the larger failure domain where the Supabase project/database is unavailable or lost.

P15 deliberately does not enable paid PITR or create another paid Supabase project.

## In-database recovery layer

`private.diet_recovery_snapshots` stores one verified snapshot per owner/source/date. It is in a private schema, browser roles have no privileges, RLS has an explicit deny policy, and each row references `auth.users(id) ON DELETE CASCADE`.

Snapshot contents cover the 18 Diet-owned tables:

`profiles`, `daily_logs`, `meals`, `meal_items`, `weight_entries`, `goal_phases`, `saved_foods`, `saved_food_portions`, `saved_meals`, `saved_meal_items`, `target_recommendations`, `activity_daily`, `training_distribution_settings`, `training_days`, `ai_actions`, `change_log`, `weekly_reviews`, and `diet_native_devices`.

Each capture verifies:

- SHA-256 payload integrity inside PostgreSQL;
- current Diet schema fingerprint;
- exact per-table row counts;
- every row belongs to the snapshot owner;
- every row can be parsed using the current live table types;
- `credential_digest` is absent from native-device backup data.

### Retention

- Daily scheduled snapshots: **35 days**
- Monthly snapshots: **370 days**
- Restore-drill snapshots: **14 days**
- Post-restore snapshots: **90 days**
- Manual/pre-restore snapshots are not automatically expired.

Database Cron runs:

- daily capture: `02:17 UTC`
- monthly capture: `02:47 UTC` on the first day of the month

## Off-site encrypted backups

The GitHub workflow **P15 Encrypted Offsite Backup** runs daily at `04:17 UTC`, after the database snapshot window.

It does not store a Supabase service key in GitHub. Instead:

1. GitHub Actions requests a short-lived OIDC token.
2. The `diet-p15-backup-export` Supabase Edge Function validates the token signature and exact claims for repository `thiepn/diet`, the main branch, the P15 workflow, repository/owner IDs, and a GitHub-hosted runner.
3. The Edge Function calls the service-role-only `diet_p15_offsite_export()` RPC from inside Supabase.
4. The runner validates the plaintext package.
5. The runner encrypts it with AES-256-GCM CMS to the committed RSA-3072 recovery certificate.
6. The plaintext file is deleted.
7. GitHub retains only the encrypted `.cms` file and a non-sensitive manifest for **90 days**.

The corresponding private key is intentionally outside GitHub and Supabase. Losing it makes these encrypted off-site artifacts unrecoverable.

Recovery certificate SHA-256 fingerprint:

`98:9E:71:79:15:B9:0B:67:7B:87:BF:FE:71:40:73:46:40:37:9F:18:C0:F8:EF:E5:59:F6:DE:01:81:6D:67:97`

Public-key DER SHA-256:

`e67ad314d1ecfdc7588f6ca08c050b0b085b468ebd5395c07ca870a0df9f070d`

## What P15 protects against

| Failure | Recovery path |
| --- | --- |
| Bad Diet write / logical corruption | Latest verified private snapshot |
| Bad database/app deployment | Verified snapshot + migration history + staged restore |
| Loss of canonical Supabase project/database | Encrypted GitHub artifact + repository migrations/schema + recovered/recreated account identity |
| Lost browser/PWA data | Canonical database / snapshot |
| Native device credential loss | Reauthenticate device; credential digest is intentionally not restored |

## Deliberate limits

### Explicit account deletion

Snapshots are **not** a hidden data-retention mechanism. Because snapshot rows cascade from `auth.users`, an explicit account deletion deletes the in-database snapshots for that identity as well. Recovery must not be used to circumvent a user's deletion request.

### Auth identity

Diet snapshots reference Supabase Auth user UUIDs but do not back up credentials, OAuth tokens, sessions, or Google identity secrets. If the entire project is lost, account/identity recovery is an Account Platform disaster-recovery concern. Before restoring Diet rows, recreate or recover the intended auth identity mapping.

### Storage objects

There is currently no Diet-owned Supabase Storage bucket. P15 therefore backs up Diet database state, not unrelated Canvas/Notes storage objects. If Diet begins storing photos/files in a Supabase bucket, object backup must be added before that bucket is considered protected.

### Native credentials

`diet_native_devices.credential_digest` is deliberately excluded. After a full recovery, native devices must reauthenticate/re-register rather than restoring old device credential material.

## Recovery runbook

1. Stop or fence Diet writes and declare a maintenance window.
2. Identify the restore point and verify its manifest/hash.
3. For an off-site artifact, decrypt it locally:
   ```bash
   scripts/p15-decrypt-backup.sh backup.cms /secure/path/diet-p15-recovery-private.pem restored.json
   ```
4. Verify the package with `scripts/p15-verify-offsite.py`.
5. Ensure the target schema/migrations match the snapshot's recorded schema/migration version.
6. Ensure the intended `auth.users` identity exists and has the correct UUID mapping.
7. Stage the snapshot into temporary tables first. Compare all row counts and owner-coupled relationships.
8. Take a `pre_restore` snapshot when the original project/database is still available.
9. Perform the restore only under explicit operator control. P15 provides no browser endpoint and no cron job that can destructively restore data.
10. Run P14 authorization probes and the P15 staging checks.
11. Take a `post_restore` snapshot.
12. Reauthenticate native devices and resume writes.

## Recovery targets

- In-database logical-recovery target RPO: **≤ 24 hours** while the daily Cron job remains healthy.
- Off-site target RPO: approximately **≤ 26 hours** under the daily schedule, assuming GitHub Actions and the Edge Function are available.
- In-database monthly historical retention: **370 days**.
- Encrypted off-site artifact retention: **90 days**.

These are operational targets, not guarantees from the Free Supabase plan.

## Production drills completed

P15 captured and verified production snapshots, manually exercised both daily/monthly job paths, and reconstructed a verified snapshot into transaction-scoped temporary tables. Every table parsed successfully, exact counts matched, all checked parent/child relationships were intact, and the drill rolled back without modifying production data.
