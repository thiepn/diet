# Diet Copilot 2.0 — P0 Production Freeze

Captured: **2026-09-29**

This document defines the immutable pre-2.0 baseline. No Diet Copilot 2.0 migration may delete or reinterpret production data without an explicit, tested migration path.

## 1. Production code baseline

- Repository: `thiepn/diet`
- Production branch: `main`
- Production commit: `d25728bd478e50c545855fb07c63a445575fa465`
- Commit title: `Release Diet Copilot Web 1.0.3: tested account lifecycle and persistence`
- Public URL: `https://thiepn.dev/diet/`
- App manifest release: `V6.8.2`
- Web release: `1.0.3`
- Release channel: `stable`
- Production bundle: `diet-app.js`
- Production styles: `diet.css`
- Runtime mode: `consolidated-stable`

Recovery pointers:

- Exact production freeze branch: `archive/diet-copilot-v1.0.3-freeze-2026-09-29`
- 2.0 working branch: `diet-copilot-2.0`
- The freeze branch points exactly at the production commit above and must never be advanced.
- `main` was not modified during P0.

GitHub Actions on the frozen commit completed successfully, including the Pages deployment and the A7/A8/A9 account/platform gates.

## 2. Canonical backend baseline

Diet Copilot uses the shared THIEPN Account Supabase project:

- Project name: `WORDSTRIKE Leaderboard`
- Project ref: `hycegznamzjhwinegaai`
- Region: `eu-west-1`
- Status at capture: `ACTIVE_HEALTHY`
- PostgreSQL engine: 17
- PostgreSQL version at capture: `17.6.1.127`
- Retired Diet backend `mrrqsqawwxwebsdmrnre` must not return to runtime configuration.

Full generated shared-project schema/type snapshot:

- `docs/diet-copilot-2.0/snapshots/supabase-types-2026-09-29.ts`

The live database migration history already contains the Diet foundation and all V6–V7 Diet migrations. The latest Diet-specific migration in the shared project at capture is:

- `20260915091937_finalize_diet_read_performance`

Later migration entries in the shared project belong to other THIEPN apps and are not Diet migrations.

## 3. Auth/session contract

The frozen app is a Google-only THIEPN Account consumer.

- Account/session authority: `thiepn-account`
- Auth entry point: Google only
- OAuth flow: PKCE
- Web callback exchange is explicit; `detectSessionInUrl: false`
- Persistent session storage is owner-scoped and guarded against stale-account data
- Network/backend failure must not silently log the user out
- Cached data may remain available in degraded read-only mode
- Ordinary app sign-out is local
- Native Android OAuth support remains part of the legacy baseline
- The dashboard is read-only with respect to canonical nutrition data

## 4. Diet table boundary

The P0 Diet-owned/used public tables are:

`profiles`, `daily_logs`, `saved_foods`, `saved_meals`, `meals`,
`meal_items`, `saved_meal_items`, `weight_entries`, `ai_actions`,
`change_log`, `goal_phases`, `target_recommendations`, `weekly_reviews`,
`activity_daily`, `saved_food_portions`, `diet_native_devices`.

At capture, all 16 tables had RLS enabled.

Direct Data API table grants for these tables were:

- `anon`: no direct table grants
- `authenticated`: `SELECT` only
- Owner-readable rows use `auth.uid() = user_id`

Canonical write operations are intentionally not direct browser table writes. Diet mutation RPCs are restricted to `service_role`; the signed-in client receives read access plus the dedicated health check.

## 5. Data integrity baseline

These are non-reversible fingerprints of complete table contents. They allow later migration verification without committing private nutrition rows to this public repository.

| Table | Rows | MD5 fingerprint |
|---|---:|---|
| activity_daily | 0 | `d751713988987e9331980363e24189ce` |
| ai_actions | 20 | `9f9f53c99543daf1a8f5262496ab7e70` |
| change_log | 0 | `d751713988987e9331980363e24189ce` |
| daily_logs | 18 | `15d72a745e94886a0fc43da187c5b604` |
| diet_native_devices | 0 | `d751713988987e9331980363e24189ce` |
| goal_phases | 2 | `f6850ed9c055ff8943b695c6284b8883` |
| meal_items | 124 | `f998b6e57450d7421cc017245b72ff56` |
| meals | 81 | `bc3966f9804c9f6d3ba614fd397841bf` |
| profiles | 1 | `cb4bd34bc544b8190a38b2a6298d7b56` |
| saved_food_portions | 8 | `edfbc08f3475c6453fad533df210280a` |
| saved_foods | 8 | `5d0dda08ea71ae25fc74545ca3b2562e` |
| saved_meal_items | 0 | `d751713988987e9331980363e24189ce` |
| saved_meals | 0 | `d751713988987e9331980363e24189ce` |
| target_recommendations | 1 | `2dc9a9ad27967c99b0d8188ebce6a69f` |
| weekly_reviews | 1 | `0a9dec0b818a591913a92d7c760df4e0` |
| weight_entries | 13 | `75dad5214db5e0c2101c4261b682f71f` |

Shared identity integrity at capture:

- Auth users: 11
- Auth user-ID fingerprint: `e11915f314de056e71fd6b22ffe29503`
- Account profiles: 11
- Account profile fingerprint: `4651152f1b3dcde9a3f7d56d087db4b4`
- Account/app links: 13
- Account/app fingerprint: `4643bd7bff1c0e04bff2079551a64848`

The fingerprints are a point-in-time baseline. Normal production logging after 2026-09-29 will legitimately change row counts and hashes; migration verification should therefore capture a fresh pre-migration fingerprint and compare it with the post-migration result.

## 6. Backup/recovery status

P0 did **not** copy private nutrition rows into this public GitHub repository.

Supabase currently provides platform database backups for hosted projects. The connected Supabase interface available during this freeze does not expose an on-demand backup/export action or the timestamp of the latest platform backup, so P0 cannot independently certify a newly-created off-platform dump from here.

Risk controls used instead:

1. No production schema or row mutations were performed during P0.
2. The exact application code was frozen at a permanent commit plus dedicated archive branch.
3. The current shared schema was exported to generated TypeScript types.
4. All Diet table row counts and full-content hashes were captured.
5. Auth/account identifier sets were fingerprinted without exposing the identifiers.
6. Migration contract and fingerprint SQL were added to the 2.0 branch.

For any destructive migration, take a fresh platform/database dump outside this repository immediately before execution and compare the pre/post fingerprints.

## 7. Shared-project advisor baseline

P0 intentionally does not alter unrelated applications in the shared Supabase project.

At capture:

- The Diet tables themselves had owner-scoped RLS and SELECT-only signed-in grants.
- Security Advisor reported warnings elsewhere in the shared project, including several signed-in-callable SECURITY DEFINER functions for shared Notes/Account functionality and leaked-password protection being disabled.
- Performance Advisor reported several informational unused/unindexed items, including some Diet indexes.

Those findings are not silently changed as part of the freeze. Any remediation must be handled as a separate shared-platform change with regression testing across all affected apps.

## 8. P0 invariants for Diet Copilot 2.0

Until an explicit cutover migration is approved:

1. Never delete legacy Diet rows.
2. Never reuse an existing column with a different meaning.
3. Preserve `user_id` ownership and account identity.
4. Preserve meal ↔ meal-item relationships.
5. Preserve raw historical weights and dates.
6. Preserve historical goal/recommendation/review records.
7. New derived analytics must be recomputable from canonical data.
8. AI output must not become canonical data without deterministic validation.
9. Schema migrations must be additive first; destructive cleanup happens only after verified cutover.
10. Every migration must pass the P0 contract and pre/post fingerprint checks.

## 9. P0 status

- [x] Exact production commit identified
- [x] Production recovery branch created
- [x] Separate Diet Copilot 2.0 branch created
- [x] Production CI/Pages success verified
- [x] Canonical Supabase project verified healthy
- [x] Current shared schema snapshot generated
- [x] Diet table inventory captured
- [x] Auth/RLS/direct-grant model captured
- [x] Diet mutation privilege boundary captured
- [x] Nutrition/history row counts and fingerprints captured
- [x] Account identity fingerprints captured
- [x] Migration verification SQL added
- [x] Production database left unchanged
- [ ] Lightweight Git tag: connector does not expose tag creation; the archive branch + immutable commit SHA are the authoritative freeze pointer
- [ ] Independent on-demand database dump: connector does not expose backup/export creation; rely on Supabase platform backups and take a fresh external dump immediately before any destructive migration
