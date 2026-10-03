# P28 — Long-Term Platform Lifecycle, Cost Efficiency & Multi-App Governance

P28 engineering implementation is **active by explicit operator override**. Earlier time-based certification gates no longer block engineering progression. The override does not authorize destructive lifecycle actions, plan upgrades, paid-resource creation, or billing changes.

## Current platform

Canonical Supabase project: **THIEPN Account** (`hycegznamzjhwinegaai`), `eu-west-1`, **ACTIVE_HEALTHY**.

Current organization: **Thiepn**, Free / `tier_free`.

Current governed inventory:

| Surface | Count |
| --- | ---: |
| Registered apps | 6 |
| Database relations | 120 |
| Database functions | 322 |
| Edge Functions | 12 |
| Cron jobs | 13 |
| Storage buckets | 1 |
| Storage objects | 14 |

There are no non-default preview branches. The default branch registry currently reports `MIGRATIONS_FAILED` while its preview project and the production project are healthy; P28 treats that as a branch-management watch item, not as evidence that production is unhealthy.

## Lifecycle model

Every app/shared service is in exactly one state:

`incubating → active ↔ maintenance → deprecated → archived → retired`

Transitions are explicit rather than inferred from inactivity. Retirement requires zero live dependents, an approved data disposition, a backup decision, and owner approval.

Retirement never automatically deletes user data, deletes a project, pauses production, rotates secrets, or drops database resources.

## Ownership

Shared does not mean ownerless.

Every governed resource is classified as app-owned, shared-service-owned, or platform infrastructure.

Current direct ownership coverage is 100% for:

- 12 Edge Functions;
- 13 cron jobs;
- the current Storage bucket.

Database ownership is governed through schema/prefix rules plus explicit legacy assignments.

The previous unresolved resources are now resolved:

- `public.change_log` → **Diet**. Diet P15/P17/P18/P20 lifecycle, backup/export, integrity and schema functions reference it.
- `public.training_distribution_settings` → **Diet**. It is directly used by `diet_app_save_training_distribution` and Diet read/export/lifecycle functions.
- `public.profiles` → **Diet** based on its calorie/protein/fiber/goal-weight/adaptive-target/reminder schema.

P28 does not rename legacy resources merely to make naming prettier. Renames require compatibility evidence and a governed migration.

## Cost model

P28 uses **showback before chargeback**.

Request counts are useful for app usage attribution, but they are not an invoice allocator. Supabase billing units include database size, egress, Storage, MAU, Edge Function invocations and Realtime usage; those dimensions must remain separate.

Current 24-hour gateway classification:

| Pool | Requests |
| --- | ---: |
| Gomoku | 22,143 |
| Micro Arcade | 2,830 |
| shared Realtime | 2,070 |
| shared Auth | 293 |
| Diet | 157 |
| platform | 66 |
| Leaderboard | 57 |
| WORDSTRIKE | 29 |
| Account | 19 |
| unattributed | 7 |

Total: **27,671**. Classified: **27,664**. Coverage: **99.97%**. Observed 5xx: **0**.

This is showback evidence only; it is not invoice share.

## Current Free-plan context

The Supabase documentation snapshot refreshed on 2026-10-03 records:

- 2 Free projects;
- 500 MB database size per project;
- 1 GB Storage;
- 5 GB uncached + 5 GB cached egress;
- 50,000 MAU;
- 500,000 Edge Function invocations;
- 2,000,000 Realtime messages;
- 200 Realtime peak connections.

Current known usage:

- database: **37,055,635 bytes**, approximately **7.07%** of 500 MB;
- Storage: **2,394 bytes**, effectively negligible against 1 GB.

Egress, MAU, billed Edge Function invocations and billed Realtime messages are **unknown from the current connector evidence**. P28 treats unknown as unknown, never zero.

Every plan/cost/quota decision must refresh current Supabase documentation and organization Usage/Billing data first.

## Quota bands

Known quota usage is classified as:

- <60%: normal;
- 60–79.99%: observe;
- 80–89.99%: plan;
- >=90%: protect.

These are planning bands. They do not automatically throttle users, delete data, buy resources, or upgrade the plan.

## Projects and branches

App count alone is never a project-split trigger.

A split requires evidence such as independent residency, billing, access control, RTO/restore needs, security isolation, sustained noisy-neighbor pressure, or one app materially driving quota saturation.

A project or branch must never be created from assumptions about cost. The current cost must be fetched for the actual organization and explicitly confirmed before creation.

Preview branches are ephemeral by default. A branch surviving beyond 24 hours without review is a governance exception.

## Supabase compatibility watch

P28 tracks platform changes that affect long-term governance.

Most importantly, Supabase will enforce the new Data API exposure behavior on existing projects on **2026-10-30**: new public tables/functions must not rely on automatic exposure. Future migrations should use explicit grants for intended API roles and appropriate RLS.

P28 also preserves the P23/P24 PostgreSQL 17.11 hazard treatment rather than using generic `REINDEX` or compatibility assumptions.

## Automation boundary

P28 automation level is **L1: audit, classify, report**.

Allowed automatically:

- manifest validation;
- ownership audits;
- lifecycle transition validation;
- quota classification;
- request showback;
- evidence/report generation.

Not allowed automatically:

- user-data deletion;
- project pause/delete;
- secret rotation;
- schema/resource deletion;
- plan upgrades;
- paid-resource creation;
- automatic throttling from a single spike.

## Scheduled governance

A weekly read-only governance workflow validates the manifests, lifecycle rules, quota semantics and non-destructive boundaries. It produces evidence artifacts only.
