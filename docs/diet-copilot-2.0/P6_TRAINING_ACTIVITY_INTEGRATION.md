# Diet Copilot 2.0 — P6 Training-Day Nutrition & Activity Integration

Status: **implemented on `diet-copilot-2.0`**

P6 adds training-day calorie/carbohydrate distribution and activity context without changing the P1/P5 ownership model.

The core policy is:

> **P1/P5 own weekly energy strategy. P6 only decides where that energy is placed during the week. Device activity is context, not calories to eat back.**

## 1. Energy hierarchy

Diet Copilot now has three separate layers:

```text
P1 adaptive expenditure engine
        ↓
P5 accepted average calorie target
        ↓
P6 weekly training-day distribution
        ↓
Today's displayed calorie / carb target
```

P6 does not write a different profile calorie target when a hard training day occurs.

The accepted P5 target remains the base average used by the adaptive engine.

## 2. Zero-sum weekly distribution

P6 adds:

`src/engine/training-nutrition.mjs`

Engine version:

`1.0.0-p6`

Default training-day shifts:

- Hard: +150 kcal
- Moderate: +75 kcal
- Light: +25 kcal
- Rest: absorbs the corresponding weekly reduction

Example with a 2,000 kcal average target:

```text
Weekly base
2,000 × 7 = 14,000 kcal

Mon  Hard   > 2,000
Tue  Rest   < 2,000
Wed  Hard   > 2,000
Thu  Rest   < 2,000
Fri  Hard   > 2,000
Sat  Rest   < 2,000
Sun  Rest   < 2,000

Weekly distributed total = 14,000 kcal
```

The plan therefore changes fuel timing, not the accepted weekly energy budget.

## 3. Exact weekly invariant

The distributor rounds ordinary daily targets around 25 kcal increments but preserves the weekly total exactly.

This also works with a legacy base target that is not divisible by 25.

The engine reports:

- `weeklyBaseCalories`
- `weeklyDistributedCalories`
- `zeroSum`

The P6 regression suite requires:

`weeklyBaseCalories === weeklyDistributedCalories`

for supported plans.

## 4. Macro distribution

P6 uses:

`hold_protein_and_fat_shift_carbs`

Protein stays stable across the week.

Fat stays stable across the week.

The calorie difference is assigned to carbohydrates.

This means a hard training day gets more carbohydrate availability without changing the weekly calorie strategy.

## 5. Weekly template

P6 adds a seven-day template:

- Monday
- Tuesday
- Wednesday
- Thursday
- Friday
- Saturday
- Sunday

Each day can be:

- Rest
- Light
- Moderate
- Hard

The user can preview the effect immediately before saving.

The preview displays:

- day type,
- calorie target,
- calorie delta,
- carbohydrate target,
- weekly base calories,
- weekly distributed calories,
- total difference.

Changing the form does not mutate the database.

Only **Save distribution** writes the settings.

## 6. Distribution settings storage

P6 adds:

`public.training_distribution_settings`

Fields include:

- owner,
- enabled state,
- weekly template,
- hard-day shift,
- moderate-day shift,
- light-day shift,
- created/updated timestamps.

Training distribution defaults to disabled until explicitly enabled.

## 7. Cross-device concurrency

Training distribution settings use optimistic concurrency.

The browser submits the last observed `updated_at`.

If another device changed the template after that read, the server rejects the stale save rather than silently overwriting it.

The same concurrency rule applies to existing training-day overrides.

## 8. Training-day overrides

P6 adds:

`public.training_days`

One nutrition classification can exist per owner/date.

A day supports:

- Rest / Light / Moderate / Hard,
- Planned / Completed / Skipped,
- optional title,
- optional duration,
- source,
- notes,
- timestamps.

The Strategy page includes a **Today override**.

A skipped training override behaves as a rest day for nutrition distribution.

Deleting the override returns the date to the recurring weekly template.

## 9. Activity source

P6 reuses the existing canonical table:

`public.activity_daily`

Available fields include:

- steps,
- active calories,
- exercise minutes,
- distance,
- resting heart rate,
- source,
- provider payload,
- sync time.

P6 did not create a second health-data table.

## 10. Activity is context only

P6 explicitly reports:

`activityCaloriePolicy = context_only_no_eat_back`

Examples:

- 1,000 exercise calories do not automatically add 1,000 kcal to the food budget.
- 20,000 steps do not directly increase today's target.
- a low step count does not directly decrease today's target.

Sustained activity changes ultimately affect P1 through actual body-weight and intake outcomes.

This prevents device calorie estimates from being double-counted on top of the adaptive expenditure engine.

## 11. Activity baseline

Activity context compares the current day with a recent median baseline when enough synced data exists.

It uses available signals such as:

- steps,
- active calories,
- exercise minutes.

Current-day activity can be classified as:

- Building baseline
- In progress
- High
- Very high

P6 deliberately avoids calling a partially completed current day “low” merely because noon activity is lower than a previous full-day total.

## 12. Health Connect

The legacy Diet Android work already exposed the native plugin contract:

`DietHealthConnect`

P6 gives V2 its own bridge instead of importing the legacy shell's `cloud` and `dashboard` globals.

V2 can now:

- configure the native plugin with the current Supabase session,
- inspect Health Connect availability,
- display permission/background-read state,
- request Health Connect permissions,
- explicitly sync activity,
- refresh V2 after the native sync.

The foreground sync window is bounded to 21 days.

That provides enough recent history for P6's activity baseline while staying inside the normal recent-history use case.

## 13. Native/web behavior

On Android with the native plugin:

- Connect Health Connect appears when permissions are missing.
- Sync activity appears when permissions are granted.
- the UI reports whether background access is available/granted.

On ordinary web/PWA:

- synced cloud activity can still be displayed,
- Health Connect controls report that the Android app is required,
- no native APIs are assumed.

## 14. No automatic polling loop

P6 does not create a browser timer that repeatedly reads Health Connect.

Foreground sync requires an explicit user action.

Existing native background-sync capability can continue to operate independently when the Android environment and permissions support it.

## 15. Today screen

The Today screen now distinguishes:

- accepted average target,
- today's distributed target,
- current training-day type,
- activity context,
- P1 confidence.

If distribution is enabled, the calorie card can show a training-day delta such as:

`hard day +150`

The displayed progress target follows P6.

The underlying P1/P5 average target remains unchanged.

## 16. Historical P1 isolation

P6 does not rewrite historical `daily_logs.calorie_target` merely to create training-day cycling.

That prevents training-day distribution from contaminating P1's accepted-plan history.

P1 continues to model expenditure from the existing intake/weight pipeline.

## 17. Secure mutation surface

P6 adds three browser actions:

1. `diet_app_save_training_distribution`
2. `diet_app_upsert_training_day`
3. `diet_app_delete_training_day`

The complete authenticated Diet app allowlist is now exactly **18 RPCs**.

Authenticated users continue to have direct SELECT-only access to Diet data tables.

There are no direct authenticated INSERT/UPDATE/DELETE grants on:

- activity data,
- training settings,
- training days,
- or the earlier Diet tables.

## 18. Activity write boundary

P6 intentionally exposes **no browser `diet_app_*activity*` mutation RPC**.

Health Connect ingestion stays behind the established native/backend integration instead of letting arbitrary browser JavaScript submit trusted health-provider activity.

The browser reads owner-scoped activity data only.

## 19. RLS

RLS is enabled on:

- `activity_daily`
- `training_distribution_settings`
- `training_days`

Each has an authenticated owner SELECT policy based on:

`auth.uid() = user_id`

Training mutation RPCs independently derive the owner from `auth.uid()`.

They accept no user-ID parameter.

## 20. Browser deployment correction

P6 certification found a pre-existing V2 deployment problem.

V2 imported P1 engine modules from:

`src/engine/`

but Jekyll intentionally excluded the entire `src/` directory from the GitHub Pages output.

Repository tests therefore worked while deployed browser module resolution could fail.

P6 fixes this by publishing only the required browser engines under:

`v2/engine/`

The deployed set is:

- `v2/engine/adaptive-nutrition.mjs`
- `v2/engine/legacy-data-adapter.mjs`
- `v2/engine/training-nutrition.mjs`

The rest of `src/` remains excluded.

CI verifies that each deployed copy is byte-for-byte identical to the canonical tested source.

## 21. P6 database runtime test

`supabase/tests/p6_training_activity_runtime.sql`

executes real owner-authenticated operations and rolls the transaction back.

It verifies:

- distribution creation/update,
- normalized weekly template storage,
- request-ID idempotency,
- stale settings rejection,
- invalid shift-order rejection,
- training-day creation,
- concurrency-safe training-day update,
- stale training-day rejection,
- training-day deletion,
- training actions do not modify `activity_daily`.

Expected result:

`diet_p6_training_activity_runtime_ok`

## 22. P6 security contract

`supabase/tests/p6_training_activity_contract.sql`

verifies:

- exact 18-RPC browser mutation surface,
- no authenticated direct Diet writes,
- SECURITY DEFINER requirement for the action façade,
- explicit `auth.uid()` ownership,
- no anonymous execution,
- no PUBLIC execution,
- RLS on activity/training tables,
- owner-only SELECT policies,
- one training classification per user/date,
- no exposed browser activity-write RPC.

Expected result:

`diet_p6_training_activity_contract_ok`

## 23. JavaScript tests

P6 adds:

- `tests/training-nutrition.mjs`
- `tests/v2-training-activity.mjs`

Coverage includes:

- zero-sum weekly distribution,
- legacy non-25 targets,
- disabled distribution,
- training-day overrides,
- skipped training,
- macro stability,
- high activity,
- partial-day activity,
- no activity calorie eat-back,
- V2 UI contract,
- exact 18-RPC allowlist,
- no direct browser table writes,
- Health Connect explicit-sync behavior,
- read-model integration,
- write API mapping,
- deployed engine parity.

## 24. P6 boundary

P6 does not yet implement:

- exercise-by-exercise programming,
- strength-volume analytics,
- automatic classification of lifting difficulty from FitNotes,
- direct Health Connect `ExerciseSessionRecord` ingestion in the V2 browser layer,
- automatic calorie increases from device expenditure,
- recovery/sleep-based target changes,
- detailed pre/intra/post-workout meal timing.

Those features can be layered on the P6 training/activity model later without violating the weekly-energy invariant.

## Result

P6 adds a second useful nutrition loop without compromising the adaptive one:

```text
P1/P5:
What should average energy intake be?
        ↓
accepted base target

P6:
Which days should receive more of that energy?
        ↓
training-day carbohydrate distribution

Health/activity:
Was this week unusually active?
        ↓
context for interpretation
        ↓
no direct calorie eat-back
```

The resulting rule is simple:

> **Train harder → move more fuel toward that day. Move more overall for weeks → let the adaptive engine learn the real expenditure change.**
