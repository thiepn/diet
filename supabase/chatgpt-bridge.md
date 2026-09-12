# Diet Copilot — ChatGPT bridge

## Product boundary

```text
User → ChatGPT → Supabase → read-only dashboard
```

The browser is deliberately a viewer. Meal logging, corrections, weight, day completion, goals, reusable foods/meals, reviews, reminders and calorie-target decisions are managed conversationally through ChatGPT.

The browser receives SELECT-only access to owner-scoped rows through RLS. Privileged helpers live in the non-exposed `private` schema.

## Live project

- Supabase project: `Diet Copilot`
- Project ref: `mrrqsqawwxwebsdmrnre`
- Region: `eu-central-1`
- Database schema generation: **6**
- Canonical dashboard: `https://thiepn.dev/diet/`

## Core rule

Before answering questions such as “how much can I still eat?”, “how did I do this week?”, “am I losing fast enough?”, or “same yogurt as last time”, read the database rather than relying on conversational memory.

## Context

```sql
select private.get_context(p_end_date, p_days);
```

Context includes current targets, goal/rate, active phase, recent daily totals/completion state, recent weights, today's meals, food/meal memory, reviews and adaptive-target state.

## Metrics snapshot

For clear range-based statistics use:

```sql
select private.get_metrics_snapshot(p_end_date, p_days);
```

Recommended ranges are 7, 28 or 90 days. It returns consistent definitions for:

- logged vs Complete days and completion rate
- average calories and calorie hit rate (within ±150 kcal)
- average absolute calorie miss
- protein average and target-hit rate
- fiber average/hit rate only on days with complete fiber coverage
- trend weight, range weight change and observed weekly pace
- goal baseline, progress %, kg remaining and ETA
- exact/reused vs estimated meal counts
- embedded Smart Coach interpretation

Incomplete/open days are deliberately excluded from adherence averages.

## Smart Coach

```sql
select private.get_smart_coach_analysis(p_end_date, p_lookback_days);
```

This returns:

- observed pace vs desired weekly pace
- pace classification (`building_baseline`, `on_pace`, `slower_than_planned`, `faster_than_planned`, `possible_plateau`)
- trend weight
- planned and observed ETA to goal
- adherence score
- maintenance-transition status

Do not call a short noisy weight fluctuation a plateau. Pace coaching waits for enough weigh-ins and time span.

## Logging meals

```sql
select private.log_meal(
  p_log_date,
  p_meal_type,
  p_title,
  p_items,
  p_confidence,
  p_source,
  p_original_input,
  p_notes,
  p_request_id
);
```

Each item can contain calories, protein, carbs, fat, fiber, brand/barcode, confidence and source when those values are actually known or reasonably estimated. Do not fabricate optional macros merely because the schema supports them.

Exact sources (`nutrition_label`, `weighed`, `manual_exact`) are promoted into reusable food memory.

## Photo meals

Photo-estimated meals should store item estimates, calorie ranges, confidence and assumptions. `photo_url` / `photo_alt` are supported only when a durable image URL exists; do not invent URLs for transient ChatGPT uploads.

## Repeat-food memory

Search memory first for phrases such as “same yogurt”, “my usual protein yogurt”, or “same Lidl salad”:

```sql
select private.search_food_memory(p_query, p_limit);
```

If one result is clearly intended, exact memory outranks a fresh estimate.

### Full remembered portion

```sql
select private.log_saved_food(p_saved_food_id,p_log_date,p_meal_type,p_request_id);
```

### Scaled remembered portion — V5.1

For “half”, “two of them”, “1.5×”, or a changed gram amount, use:

```sql
select private.log_saved_food_scaled(
  p_saved_food_id,
  p_log_date,
  p_meal_type,
  p_multiplier,
  p_quantity_text,
  p_request_id
);
```

Scale all known nutrients proportionally. Keep unknown nutrients unknown. Prefer a multiplier derived from an explicit quantity when possible (for example 100 g of a remembered 200 g cup → 0.5×).

If multiple food memories match, clarify instead of guessing.

## Repeat-meal memory

```sql
select private.remember_meal(...);
select private.remember_meal_from_history(p_meal_id,p_name,p_aliases,p_request_id);
select private.search_meal_memory(p_query,p_limit);
select private.log_saved_meal(p_saved_meal_id,p_log_date,p_meal_type,p_request_id);
```

Use this for genuinely recurring multi-item meals. Do not silently equate vaguely similar meals.

## Corrections and deletion

Read/search first and keep latest `updated_at` before calling:

```sql
select private.update_meal(...);
select private.delete_meal(...);
```

A meaningful change on a completed day reopens that day so the edited day cannot remain falsely finalized.

## Weight

```sql
select private.log_weight(p_entry_date,p_weight,p_notes,p_request_id);
```

One weight exists per owner/date; a later value for the same date updates it and records the previous state.

## Day completion

When the user says “done eating”, “that's everything today”, or equivalent:

```sql
select private.set_day_status(p_log_date,'complete',p_request_id);
```

To reopen explicitly:

```sql
select private.set_day_status(p_log_date,'open',p_request_id);
```

Only Complete days feed calorie/protein/fiber adherence averages.

## Goals and phases

Profile preferences:

```sql
select private.update_profile_preferences(p_patch,p_request_id);
```

Structured phases:

```sql
select private.start_goal_phase(...);
select private.end_goal_phase(...);
```

Phase types: `cut`, `maintain`, `gain`, `custom`. Do not invent a goal weight, target pace or target calories.

## Weekly review

```sql
select private.generate_weekly_review(p_week_end);
```

The V5.1 review includes complete-day intake averages, calorie/protein/fiber adherence, weigh-ins/weight change, Smart Coach pace status, goal ETA and maintenance-transition context.

Incomplete days must never masquerade as low-calorie success.

## Adaptive calorie calibration

Generate a proposal:

```sql
select private.generate_target_recommendation(p_end_date,p_lookback_days);
```

Guardrails:

- desired weekly weight change must be set
- default minimum is 14 Complete days
- at least 4 weigh-ins spanning at least 7 days
- regression-based observed weight trend
- maintenance estimate based on recorded intake + observed trend
- proposed change capped to ±250 kcal and rounded to 25 kcal
- **never silently apply a recommendation**

After explicit approval:

```sql
select private.accept_target_recommendation(p_recommendation_id,p_request_id);
```

If rejected:

```sql
select private.dismiss_target_recommendation(p_recommendation_id,p_request_id);
```

## Maintenance transition

When Smart Coach returns `prepare_transition` or `transition_now`, explain the recommendation. Do not automatically end the cut/gain or alter calories. A phase transition is a user decision.

## Reminders

Persist preferences with:

```sql
select private.set_reminder_preferences(p_patch,p_request_id);
```

Actual ChatGPT automation delivery is separate and should only be scheduled when the user provides or accepts a concrete cadence/time.

## Confirmation policy

Do not ask for routine confirmation when logging is clear. Clarify only when ambiguity could materially change the record, such as unclear portion eaten, major unknown oils/sauces, multiple plausible memories, or goal/target decisions that should not be guessed.

## Response after writes

Keep confirmations compact, then query fresh context again. Example:

```text
Logged snack: 142 kcal · 20 g protein · 0.2 g fiber (nutrition label).
Today: 142 / 2,000 kcal · 1,858 kcal remaining.
```

Always use the current database target rather than assuming the target from a previous conversation.

## Security

Authenticated browser sessions are SELECT-only. Private write/coach helpers are not granted to browser roles. Realtime publication is enabled for dashboard tables, with owner-scoped RLS controlling readable rows.
