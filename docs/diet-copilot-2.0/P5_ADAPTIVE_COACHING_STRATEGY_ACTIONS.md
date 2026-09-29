# Diet Copilot 2.0 — P5 Adaptive Coaching & Strategy Actions

Status: **implemented on `diet-copilot-2.0`**

P5 turns the P1 adaptive nutrition engine from a read-only recommendation into an explicit, auditable strategy workflow.

The core rule is:

> **Diet Copilot may calculate continuously, but it never changes the user's calorie target silently.**

## Product outcome

The Strategy page now shows:

- current goal mode,
- goal weight,
- planned weekly rate,
- estimated expenditure,
- expenditure range,
- current calorie target,
- P1 recommendation,
- target delta,
- observed weekly rate,
- reliable intake days,
- weigh-in count,
- weight-history span,
- confidence score,
- P1 engine version,
- recommended protein / fat / carbohydrate guidance,
- recommendation rationale,
- review state,
- target-application date,
- strategy-review history,
- revert action for the latest accepted review.

## User workflow

The normal P5 loop is:

```text
P1 continuously recalculates
        ↓
Strategy shows recommendation + evidence
        ↓
Review recommendation
        ↓
persist immutable review snapshot
        ↓
user chooses:
   ├─ Accept target
   └─ Keep current
        ↓
record resolution
```

There is deliberately no:

```text
engine output → automatic target mutation
```

## Calculation authority

P5 does **not** switch back to the older SQL recommendation algorithm.

The current calculation source remains:

`src/engine/adaptive-nutrition.mjs`

Current engine version:

`1.0.0-p1`

The same deterministic P1 engine already powers the Strategy read model.

The backend does not blindly trust an arbitrary number from the browser. It validates the staged snapshot against current server state and enforces adjustment bounds before allowing it to become an actionable review.

## Staging a review

P5 introduces:

`public.diet_app_stage_strategy_review(...)`

The client sends a versioned P1 snapshot containing:

- engine version,
- generated date,
- lookback window,
- decision,
- current target,
- recommended target,
- raw target,
- estimated expenditure,
- confidence level,
- confidence score,
- reason,
- recommended macros,
- evidence payload.

The server independently adds:

- current profile target,
- current protein/fiber target,
- goal weight,
- desired weekly rate,
- adaptive-enabled state,
- active goal-phase ID,
- phase type,
- phase name,
- phase start,
- phase nutrition targets,
- server staging time.

This server context is used for stale-review checks and later revert.

## Stage validation

A staged review must satisfy server rules including:

- authenticated owner,
- valid request ID,
- current target still matches the profile,
- engine version is bounded and syntactically valid,
- generated date is current,
- lookback is 14–60 days,
- decision belongs to the P1 decision vocabulary,
- confidence is within valid range,
- payload is a bounded JSON object,
- calorie values stay within allowed ranges,
- suggested macro values stay within allowed ranges.

### Normal weekly adjustment bounds

For ordinary P1:

- `increase`: must increase target and may change at most **150 kcal**,
- `decrease`: must decrease target and may change at most **150 kcal**.

This matches the P1 engine's current:

`maximumWeeklyTargetStepKcal = 150`

Non-actionable decisions such as:

- `need_more_data`,
- `hold_for_confidence`,
- `keep_target`,
- `prepare_maintenance`

cannot stage a different calorie target.

## Duplicate suppression

A repeated identical strategy review within 12 hours is reused rather than creating another recommendation row.

Matching includes:

- owner,
- generated date,
- engine version,
- decision,
- current target,
- recommended target.

The response reports:

`deduplicated: true`

when this path is used.

Normal request-ID idempotency remains in place for actual action calls.

## Recommendation history

P5 extends `target_recommendations` with:

- `engine_version`
- `confidence_level`
- `confidence_score`
- `recommended_protein`
- `recommended_fat`
- `recommended_carbs`
- `effective_date`
- `resolution`
- `resolved_target`
- `applied_phase_id`

Statuses now support:

- `pending`
- `advisory`
- `insufficient`
- `accepted`
- `dismissed`
- `superseded`
- `reverted`

Previous reviews are not deleted when a new review is generated.

An older unresolved review becomes:

`superseded`

rather than disappearing.

## Accept target

P5 introduces:

`public.diet_app_resolve_strategy_review(...)`

with:

`resolution = accept`

Acceptance is only possible for a current `pending` review.

Before changing anything the server verifies:

- the review belongs to the authenticated owner,
- the review is still open,
- the user's current target still equals the target used when the review was generated,
- the recommendation contains a valid target,
- the requested effective date is today or tomorrow.

If the target changed after the review was staged, acceptance fails with a conflict.

## Historical target periods

P5 does **not** overwrite an old goal phase when an adjustment is accepted.

If the active phase began before the new effective date:

```text
old active phase
  end_date = effective_date - 1
  active = false

new active phase
  start_date = effective_date
  new calorie target
```

This preserves the historical target period.

If the phase already begins on the effective date, that same-day phase can be updated because there is no earlier period inside that day to preserve.

## Future daily targets

When a recommendation is accepted, P5 updates only:

- profile current target,
- active/new goal phase,
- daily logs on or after the effective date that are **not complete**.

Completed historical days are never rewritten.

## Protein target

The accepted P1 review may also carry the current versioned P1 protein recommendation.

If available, it becomes the new protein target alongside the calorie target.

P1 fat and carbohydrate targets are stored as guidance in the recommendation snapshot but are not written into profile columns because the existing Diet schema does not currently use canonical daily fat/carbohydrate target columns.

## Maintenance transition

For:

`transition_maintenance`

acceptance creates/updates the target period as:

- phase type: `maintain`
- weekly target change: `0`
- calorie target: explicit accepted P1 maintenance target.

This is still an explicit user action.

P5 does not silently switch goal mode merely because the engine detects proximity to the goal.

## Keep current

Resolving with:

`keep_current`

does not modify:

- calorie target,
- protein target,
- active goal phase,
- future daily targets.

The review becomes:

- status: `dismissed`
- resolution: `kept_current`

This allows the system to remember that the recommendation was consciously reviewed rather than merely ignored.

## Revert

P5 introduces:

`public.diet_app_revert_strategy_review(...)`

A revert:

1. loads the server-owned context captured when the recommendation was staged,
2. checks that the currently active plan still corresponds to that accepted review,
3. rejects the revert if a newer accepted recommendation exists,
4. restores the previous calorie/protein/goal configuration,
5. creates a new historical target period rather than deleting the accepted period,
6. marks the original recommendation `reverted`.

This makes acceptance reversible without rewriting history.

## Strategy UI evidence

The user sees the major inputs behind the recommendation:

### Expenditure

- estimated expenditure,
- likely range.

### Weight pace

- observed weekly trend,
- planned weekly trend.

### Data sufficiency

- effective intake days,
- weigh-in count,
- time span.

### Calculation identity

- P1 engine version,
- numerical confidence score.

### Macro guidance

- protein,
- fat,
- carbohydrates.

The rationale remains visible above the action controls.

## Open-review freshness

The UI only exposes Accept / Keep-current controls when the saved review still matches:

- current engine version,
- current date,
- current calorie target,
- current recommended target,
- current decision.

If the P1 result has changed since the snapshot was staged, the UI instead asks the user to refresh the review.

The backend stale-target guard independently enforces this even if the client check is bypassed.

## Browser mutation API

P5 expands the exact browser mutation allowlist from 12 to **15** functions:

1. `diet_app_log_meal`
2. `diet_app_log_saved_food`
3. `diet_app_log_saved_meal`
4. `diet_app_repeat_meal`
5. `diet_app_delete_meal`
6. `diet_app_update_meal`
7. `diet_app_save_meal_from_history`
8. `diet_app_save_food`
9. `diet_app_set_saved_food_favorite`
10. `diet_app_delete_saved_food`
11. `diet_app_set_saved_meal_favorite`
12. `diet_app_delete_saved_meal`
13. `diet_app_stage_strategy_review`
14. `diet_app_resolve_strategy_review`
15. `diet_app_revert_strategy_review`

Authenticated Diet tables remain directly **SELECT-only**.

The P5 functions:

- derive ownership from `auth.uid()`,
- accept no user-ID argument,
- use an empty `search_path`,
- are explicitly revoked from `PUBLIC`,
- are explicitly revoked from `anon`,
- expose only bounded owner actions.

## Frontend modules

P5 adds:

`v2/strategy-actions.js`

Responsibilities:

- create a versioned review snapshot,
- render saved/open-review state,
- require explicit acceptance,
- handle Keep current,
- choose today/tomorrow effective date,
- render recommendation history,
- request revert.

It performs no direct table writes.

The only mutation path is the explicit allowlisted RPC client in:

`v2/write-api.mjs`

## Read-model integration

P5 extends the owner-scoped data load with:

`target_recommendations`

and subscribes to it through Realtime.

The V2 read model now exposes:

- P1 macros,
- P1 engine version,
- confidence components,
- reliable intake days,
- weigh-ins,
- weight span,
- observed weekly rate,
- average intake,
- expenditure range,
- current/open review,
- latest resolved review,
- review history.

## Runtime validation

`supabase/tests/p5_strategy_runtime.sql`

runs real operations inside a transaction and then rolls everything back.

It validates:

- stale-current-target rejection,
- actionable review staging,
- duplicate review suppression,
- review acceptance,
- profile target update,
- goal-phase target-period split,
- previous phase deactivation,
- revert,
- previous target restoration,
- review marked reverted,
- advisory review creation,
- Keep current resolution,
- Keep current leaves the calorie target unchanged.

Live result:

`diet_p5_strategy_runtime_ok`

## Security contract

`supabase/tests/p5_strategy_contract.sql`

verifies:

- no authenticated direct Diet table writes,
- exact 15-RPC app allowlist,
- all app RPCs remain SECURITY DEFINER,
- all explicitly bind to `auth.uid()`,
- no anon execution,
- no PUBLIC execution,
- target-recommendation P5 history columns exist,
- target-recommendation RLS remains enabled,
- owner-scoped authenticated SELECT policy remains present,
- stale-review conflict guard exists,
- goal-phase history splitting exists.

Live result:

`diet_p5_strategy_contract_ok`

## JavaScript regression suite

`tests/v2-strategy-actions.mjs`

checks:

- Strategy evidence/action/history UI,
- exact 15-RPC allowlist,
- no direct table mutation in Strategy UI,
- no privileged browser keys,
- explicit-click acceptance,
- P5 SQL functions,
- P5 history schema,
- versioned P1 engine,
- recommendation-history normalization,
- stage RPC mapping,
- resolve RPC mapping,
- revert RPC mapping.

## P5 boundary

P5 intentionally does not yet add:

- autonomous target changes,
- AI ownership of numeric strategy,
- training-day/rest-day calorie cycling,
- Health Connect activity adjustment,
- AI-written coaching summaries,
- push reminders for weekly reviews.

Those can build on P5's review/action history without changing who owns the decision.

## Result

P5 completes the deterministic adaptive strategy loop:

```text
food + weight history
       ↓
P1 expenditure estimate
       ↓
P1 recommendation
       ↓
evidence + explanation
       ↓
explicit review
       ↓
Accept / Keep current
       ↓
versioned target period
       ↓
optional safe revert
```

The main invariant is now enforceable both in the UI and the database:

> **Diet Copilot calculates the recommendation. The user decides whether the plan changes.**
