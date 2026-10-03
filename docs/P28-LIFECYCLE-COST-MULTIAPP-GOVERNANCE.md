# P28 — Long-Term Platform Lifecycle, Cost Efficiency & Multi-App Governance

P28 is **staged, not active**.

Dependency chain:

**P25 → P26 → P27 → P28**

P28 exists so the shared THIEPN backend can scale from the current collection of apps toward dozens or 100+ apps without becoming an ownerless database, an untraceable bill, or a set of resources that nobody can safely retire.

## Current platform shape

The canonical Supabase project is **THIEPN Account** in `eu-west-1`.

Current organization plan: **Free**.

Registered user-facing apps:

- Notes
- Diet Copilot
- WORDSTRIKE
- Gomoku Studio
- Word to the Nations
- TMS60

Additional shared services currently include Account, Canvas, Leaderboard, Micro Arcade and platform-control infrastructure.

P28 deliberately distinguishes these classes. A shared leaderboard service is not the same thing as a registered app, and Auth/Realtime are infrastructure rather than app-owned tables.

## Cost model

P28 uses **showback before chargeback**.

Supabase bills at organization/project/usage-item boundaries, not according to THIEPN app names. Therefore P28 never invents a euro cost for an app from API request counts.

Direct attribution can use:

- app-specific API paths;
- app-owned Edge Functions;
- app-owned storage buckets;
- app-owned cron jobs;
- app-owned database surfaces.

Shared pools remain separate:

- Auth;
- shared Realtime;
- Account;
- platform control/health;
- base database compute;
- shared logging.

Only after representative attribution coverage exceeds 90% may P28 consider a chargeback-style allocation model.

### Current Free-plan context

The current Supabase organization reports `free / tier_free`.

The current documentation snapshot observed on 2026-10-01 lists Free-plan quotas including:

- 5 GB egress;
- 500 MB database size per project;
- 50,000 MAU;
- 1 GB Storage;
- 500,000 Edge Function invocations;
- 2,000,000 Realtime messages;
- 200 Realtime peak connections.

These values are **not permanent constants**. P28 requires the current Supabase Usage/Billing documentation and organization usage page to be refreshed before any plan, budget, or paid-resource decision.

Spend Cap is not treated as a current control because Supabase documents it as a Pro-plan feature. Free-plan quota exhaustion can restrict service even though there is no paid overage.

Current database size is about **26 MB**, roughly **5.11%** of the documented 500 MB project database quota. The only Storage bucket currently observed contains 14 tiny CI assets totaling 2,394 bytes.

There is no current cost-driven reason to split apps into additional Supabase projects.

## Current request attribution

A post-upgrade gateway sample contained 3,578 requests.

Path classifier result:

| Pool | Requests |
| --- | ---: |
| Gomoku | 3,084 |
| shared Realtime | 307 |
| Account | 66 |
| shared Auth | 64 |
| Diet | 27 |
| Leaderboard | 8 |
| platform | 8 |
| unattributed | 14 |

Classification coverage: **99.61%**.

This shows why equal-per-app allocation would be misleading. It does **not** mean Gomoku owns the same percentage of the Supabase invoice: API requests, Realtime messages, MAU, compute, disk and egress are different billing units.

## Lifecycle states

Every governed component has one lifecycle state:

- `incubating`
- `active`
- `maintenance`
- `deprecated`
- `archived`
- `retired`

### Active

An active app requires:

- an owner;
- canonical route/repository;
- resource ownership;
- data export/deletion behavior;
- dependencies;
- release/security contract.

### Maintenance

The app continues to receive security/compatibility work even if feature work is frozen.

### Deprecated

Deprecation requires an explicit successor/no-successor decision, migration/export path, appropriate user notice, and retirement criteria.

### Archived

Normal writes are disabled; required exports/backups and dependency contracts remain preserved.

### Retired

Retirement requires zero live consumers plus explicit data, backup, route, function, job, storage and secret disposition.

**Retirement never automatically deletes user data.**

## Resource ownership

Shared does not mean ownerless.

Every production resource must be classified as:

1. app-owned;
2. shared-service-owned; or
3. platform infrastructure.

Covered resource classes include:

- database relations;
- database functions/RPCs;
- Edge Functions;
- cron jobs;
- storage buckets;
- public routes;
- secrets/configuration;
- dependencies.

New app resources should use an app prefix or a dedicated app-owned private schema. New unprefixed public resources require explicit shared-contract classification.

### Legacy resources

The platform predates this naming rule. Many older Diet and Account functions have generic names such as `log_meal`, `get_context`, and `delete_thiepn_account`.

P28 does **not** rename those during the current burn-in/steady-state phases. It records semantic ownership first. Any later rename requires backward compatibility and a migration plan.

One relation is intentionally left unresolved: `public.change_log`. It is empty and generic, so P28 refuses to guess an owner. P28 cannot be certified until its ownership/disposition is explicitly resolved.

`public.training_distribution_settings` is a probable Diet resource based on its domain/name, but remains a provisional assignment until governance certification.

## Multi-app change governance

A change becomes a **shared-platform change** when it affects any of:

- more than one app owner;
- identity/account contracts;
- platform-control surfaces;
- shared Edge Functions;
- shared cron;
- organization billing/plan/project topology.

Shared changes require:

- affected owner list;
- compatibility matrix;
- migration/deployment evidence;
- rollback or forward-fix plan;
- P20 governance registration;
- coordination with any active upgrade/certification quiet window.

This directly prevents the P24 problem where parallel Gomoku changes repeatedly invalidated a supposedly final shared-platform certification.

## When to split an app into a separate Supabase project

P28 does **not** use app count as a split trigger.

A separate project becomes justified by evidence such as:

- independent region/data-residency requirement;
- independent billing boundary;
- independent team/access-control boundary;
- separate backup/restore or RTO requirement;
- sustained noisy-neighbor pressure;
- one app dominating a project quota;
- compliance/security isolation.

On paid organizations, Supabase documents that each project has dedicated compute and therefore additional projects can add compute cost. Project topology is an architectural and billing decision, not merely a code-organization preference.

## Preview branch lifecycle

The current project has no non-default preview branch.

P28 default:

- preview branches are ephemeral;
- delete them when the task ends;
- persistent branches require an explicit reason;
- any branch remaining beyond 24 hours without review is a governance exception;
- branch/project creation requires cost confirmation first.

## Quota and cost guardrails

Default quota bands:

- **60%** — observe;
- **80%** — plan;
- **90%** — protect.

These bands trigger investigation/planning, not automatic throttling or deletion.

New paid resources always require explicit approval. This includes new paid projects, long-lived branches, compute changes, read replicas, PITR, IPv4, custom domains, extra IOPS/throughput and log drains.

## Retirement safety

P28 autonomous lifecycle actions may never:

- delete user data;
- delete a production project;
- pause production;
- rotate secrets;
- drop database resources;
- disable a live app;
- remove backups.

Those require an explicit governed retirement action with dependency and data-disposition evidence.

## Activation

P28 remains `staged_pending_p27` until P27 is formally certified.

Before P28 itself can complete, resource ownership must reach 100%, all active apps need lifecycle/data/dependency manifests, and a representative 30-day cost-attribution window must reach at least 90% classification coverage.
