# Diet Copilot 2.0.1 — P15 production resilience gates

Date: 2026-09-29. Phase: P15 Backup, Disaster Recovery & Production Data Resilience.

## Required gates

| Gate | Coverage |
| --- | --- |
| CI | P13 privacy regression, P14 security regression, P15 resilience contract, metadata and Pages artifact |
| A7/P15 operations | degraded-mode/write safety, P14 security, P15 recovery metadata |
| A8 account consumer | Google-only PKCE, canonical project, P15 operations metadata |
| A9 account platform | Account Platform v1 with Diet Web 2.0.1 |
| P14 public security | anonymous/publishable clients remain outside Diet read/write boundary |
| P15 database verification | snapshot hashes/schema/counts/ownership/type parsing |
| P15 scheduled snapshot drill | daily and monthly capture paths produce verified snapshots |
| P15 restore staging drill | full snapshot reconstructs into temporary typed tables; relationships remain intact; rollback only |
| P15 encrypted off-site | GitHub OIDC → Edge export → local validation → CMS AES-256-GCM encryption → encrypted artifact only |
| Advisors | no new P15 performance/security issue after explicit private-table deny policy |

## Recovery invariants

- All 18 Diet-owned tables are included in a verified owner snapshot.
- `diet_native_devices.credential_digest` is excluded.
- Snapshot payload and current schema are fingerprinted.
- A snapshot is not accepted unless row counts, ownership and table-type parsing all pass.
- In-database snapshots cascade-delete when their `auth.users` identity is deleted.
- No browser role can access the private snapshot table.
- Destructive restore is never available to the browser or a scheduled job.
- A restore must be staged and reviewed first.
- No private recovery key is committed to the repository.
- Off-site artifacts contain ciphertext and non-sensitive evidence only; plaintext JSON is deleted before upload.

## Target recovery windows

- Daily in-database logical-recovery RPO target: ≤ 24h while Cron remains healthy.
- Daily encrypted off-site RPO target: approximately ≤ 26h under the configured schedules.
- Daily in-database retention: 35 days.
- Monthly in-database retention: 370 days.
- Encrypted GitHub artifact retention: 90 days.

These are Diet operational targets rather than guarantees from the Supabase Free plan.

## Full-project loss limitation

Diet snapshots preserve Diet application rows, not Google OAuth credentials, sessions, or the wider THIEPN Account ecosystem. A full shared-project recovery requires restoring/recreating the intended account identity before Diet rows can be restored. Native devices must reauthenticate after such a recovery.
