# Diet Copilot 2.0.3 — P24 validated / P25 burn-in active

Date: 2026-10-01.

| Gate | Current state |
| --- | --- |
| Hosted Supabase upgrade | validated |
| Supabase build | 17.6.1.127 → 17.6.1.164 |
| PostgreSQL server | 17.6 / 170006 |
| PostgreSQL 17.11 compatibility baseline | tracked separately; not yet met by hosted server |
| Semantic shared fingerprint | platform-p23-shared-schema-v2 |
| P24 post-upgrade validator | pass |
| P18 integrity | clean |
| P20 schema drift | false |
| P21 readiness | pass |
| P22 maintenance | pass |
| cron | 8/8 active; 0 post-upgrade validation failures |
| replication slots | 0 blocking |
| Auth | successful post-upgrade requests observed |
| Realtime | post-upgrade health 200 observed |
| PostgREST | successful post-upgrade traffic observed |
| Storage | post-upgrade traffic observed |
| Edge Functions | all ACTIVE |
| cross-app read smoke | pass |
| P25 | burn_in_active |

## Hosted-upgrade evidence

- Pre-upgrade Supabase build: `17.6.1.127`
- Post-upgrade Supabase build: `17.6.1.164`
- Release channel: `ga` → `preview`
- Postmaster restart: `2026-10-01T07:54:44.803638Z`
- Pre-upgrade v1 SHA: `8239b32928be652214a63ae733d42bace71d46d7145e3e6e5eea8b7f066e1dfe`
- Post-upgrade v2 semantic SHA: `c6a7b8788a3798e3fe119007e55f7d1b5796ece574a27dd10abeb600179a9918`
- Validation migration: `20261001121450_platform_p24_post_upgrade_hosted_build_validation`
- Managed event status: `validated`

## Fingerprint correction

The old v1 shared fingerprint included `pg_policy.polroles::text`, which serializes internal PostgreSQL role OIDs. Hosted rebuilds may change those OIDs even if the RLS policy itself is unchanged.

The v2 contract serializes sorted role names instead. This removes false drift while preserving semantic policy comparison.

## Cross-app evidence

Read-only database checks succeeded across THIEPN Account, Diet Copilot, Notes, TMS60, WTTN, Wordstrike, Gomoku, Leaderboard, Micro Arcade and Canvas. Current app relation/function counts match the pre-upgrade baseline exactly. The platform-control surface increased from 1 relation / 8 functions to 2 relations / 10 functions because P24 added its post-upgrade attestation table and validation functions.

## P25 active burn-in

- Start: `2026-10-01T12:14:50.879365Z`
- Earliest completion: `2026-10-02T12:14:50.879365Z`
- Minimum duration: 24 hours
- Minimum public samples: 12 spanning the window
- Hourly workflow: `.github/workflows/p25-post-upgrade-burnin.yml`
- Completion still requires the first post-upgrade encrypted P15 backup and final operational checks.

P25 must not be marked complete before the minimum window ends.
