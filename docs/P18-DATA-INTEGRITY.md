# P18 — Production Data Integrity, Consistency & Corruption-Detection Hardening

Date: 2026-09-29. Browser release remains Web 2.0.3. Operations release: P18.0.

P18 adds database-level integrity guarantees and a scheduled corruption watchdog. It does not change Diet's nutrition engine, browser behavior, account lifecycle, backup encryption, or owner authorization model.

## Release audit

Before installing constraints, production data was checked for the states P18 intends to reject. All checks returned zero invalid rows.

The first P18 release audit then completed with:

- 17 integrity checks;
- 0 failed checks;
- 0 failures;
- 0 warnings;
- status: `clean`;
- auto-repair: disabled.

## Database constraints

P18 adds and validates nine database CHECK constraints:

1. `meals_nutrition_integrity_p18`
2. `meal_items_nutrition_integrity_p18`
3. `saved_foods_nutrition_integrity_p18`
4. `saved_meals_nutrition_integrity_p18`
5. `saved_meal_items_nutrition_integrity_p18`
6. `profiles_targets_integrity_p18`
7. `daily_logs_targets_integrity_p18`
8. `goal_phases_targets_integrity_p18`
9. `target_recommendations_integrity_p18`

These reject objectively invalid states such as negative calories/macros, invalid uncertainty ranges, non-positive required targets, non-positive recipe servings, negative recommendation counts/macros, and confidence scores outside 0–1.

P18 does not impose arbitrary upper calorie, body-weight, macro, or target limits.

## Integrity watchdog

`private.diet_p18_integrity_report()` performs 17 checks spanning:

- cross-owner relationship consistency;
- meal aggregate calories/protein vs item sums;
- saved-meal aggregate calories/protein vs item sums;
- more than one active goal phase per owner;
- blank reusable-food/meal names;
- recommendation resolution-state coherence;
- invalid numeric nutrition states;
- all 18 Diet tables retaining auth-user cascade deletion;
- P15 recovery snapshots retaining auth-user cascade deletion.

The watchdog is read-only. It never repairs, changes, or deletes nutrition data.

## False-positive controls

Two findings from the exploratory audit were deliberately **not** encoded as corruption:

- A meal timestamp can fall on the prior UTC date while correctly belonging to the current local Diet day. Diet's canonical day remains `daily_logs.log_date`.
- A goal phase can end on the same date a replacement starts. The existing read model deterministically selects the latest applicable phase, so a same-day boundary is not automatically treated as corruption.

P18 therefore monitors invariants that are unambiguously invalid rather than encoding assumptions about timezone or phase-boundary semantics.

## Private audit ledger

Each scheduled/manual audit is stored in `private.diet_integrity_audits` with:

- audit timestamp;
- source;
- clean/warning/critical status;
- check/failure counts;
- the operational check report.

Retention is 180 days.

The private table has RLS enabled, an explicit restrictive deny policy for authenticated clients, and no browser table grants.

## Access boundary

The operational report is exposed through `public.diet_p18_integrity_report()` only for the `service_role`.

`anon` and `authenticated` have no execute permission. Diet browser JavaScript does not reference the P18 report or audit runner.

## Scheduled audit

Supabase Cron runs:

`diet-p18-integrity-daily`

at **03:17 UTC every day**.

This follows the 02:17 daily P15 recovery snapshot and precedes the 04:17 encrypted off-site backup.

Audit history older than 180 days is pruned during an audit run.

## Failure handling

P18 intentionally does not auto-repair a failed invariant.

A warning or critical result is evidence for operator investigation. Recovery can then use the P15 verified snapshot/restore tooling if necessary.

This prevents a corruption detector from becoming a second uncontrolled mutation engine.

## Production verification

P18 certification verifies:

- all nine constraints are validated;
- an attempted negative-calorie write is rejected by PostgreSQL;
- all 17 checks currently pass;
- scheduled Cron exists exactly once;
- the private audit ledger is inaccessible to authenticated clients;
- the service report is inaccessible to publishable/anonymous clients;
- Supabase advisors have no P18-specific security or performance findings;
- P14 security, P15 recovery, P16 performance, and P17 privacy contracts remain intact.
