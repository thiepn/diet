# Diet Copilot — ChatGPT bridge

## Product boundary

```text
User → ChatGPT → canonical Supabase backend → read-only dashboard
```

The browser is deliberately a viewer. Meal logging, corrections, weight, goals, reusable foods/meals, reviews, reminders and calorie-target decisions are managed conversationally through ChatGPT.

The browser receives SELECT-only access to owner-scoped rows through RLS. Privileged helpers live in the non-exposed `private` schema.

## Canonical production backend

**This section is authoritative. Do not choose a Supabase project by display name.**

- Canonical project ref: `hycegznamzjhwinegaai`
- Region: `eu-west-1`
- Identity: shared **THIEPN Account** project
- Canonical dashboard: `https://thiepn.dev/diet/`
- Legacy Diet Copilot project ref: `mrrqsqawwxwebsdmrnre` — **retired; never read from or write to it**

The legacy project can still appear in tooling with the display name `Diet Copilot`. That name is stale. Always select the canonical project by **project ref**.

Saved-food IDs, meal IDs, daily-log IDs and user IDs are backend-specific. Never copy an ID from the legacy project into a canonical write. Search/read the canonical backend first and use IDs returned there.

## Required write protocol

For every ChatGPT write:

1. Assert the target project ref is `hycegznamzjhwinegaai`.
2. Read canonical context/memory first when the action depends on existing state.
3. Use a stable, unique `p_request_id` for the user action.
4. If retrying the same user action, reuse the same `p_request_id`; do not generate a second one.
5. After the write, query fresh canonical context and verify the resulting totals/record.
6. Never mirror or dual-write the same action to another Supabase project.

This idempotency rule prevents accidental duplicate meals when a request is retried.

## Core context

Before answering questions such as “how much can I still eat?”, “how did I do this week?”, “am I losing fast enough?”, or “same yogurt as last time”, read the canonical database rather than relying on conversational memory.

```sql
select private.get_context(p_end_date, p_days);
```

Context includes current targets, goal/rate, active phase, recent daily totals, recent weights, today's meals, food/meal memory, reviews and adaptive-target state.

## Metrics snapshot

```sql
select private.get_metrics_snapshot(p_end_date, p_days);
```

Recommended ranges are 7, 28 or 90 days. It returns consistent definitions for intake, protein, fiber coverage, weight trend, goal progress, data quality and coaching context.

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

Search canonical memory first:

```sql
select private.search_food_memory(p_query, p_limit);
```

If one result is clearly intended, exact memory outranks a fresh estimate.

### Full remembered portion

```sql
select private.log_saved_food(
  p_saved_food_id,
  p_log_date,
  p_meal_type,
  p_request_id
);
```

### Scaled remembered portion

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

Scale all known nutrients proportionally. Keep unknown nutrients unknown. Prefer a multiplier derived from an explicit quantity. If multiple canonical food memories match, clarify instead of guessing.

## Repeat-meal memory

```sql
select private.remember_meal(...);
select private.remember_meal_from_history(p_meal_id,p_name,p_aliases,p_request_id);
select private.search_meal_memory(p_query,p_limit);
select private.log_saved_meal(p_saved_meal_id,p_log_date,p_meal_type,p_request_id);
```

Use this only for genuinely recurring multi-item meals. Do not silently equate vaguely similar meals.

## Corrections and deletion

Read/search canonical state first and keep the latest `updated_at` before calling:

```sql
select private.update_meal(...);
select private.delete_meal(...);
```

Never delete a record merely because the UI looks duplicated. First query the canonical database and prove whether two persisted rows actually exist.

## Weight

```sql
select private.log_weight(p_entry_date,p_weight,p_notes,p_request_id);
```

One weight exists per owner/date; a later value for the same date updates it and records the previous state.

## Day status

```sql
select private.set_day_status(p_log_date,'complete',p_request_id);
select private.set_day_status(p_log_date,'open',p_request_id);
```

Day status is metadata. Do not use an open/partial state as a reason to discard otherwise valid logged intake or weigh-in data when reporting what is known.

## Goals and phases

```sql
select private.update_profile_preferences(p_patch,p_request_id);
select private.start_goal_phase(...);
select private.end_goal_phase(...);
```

Phase types: `cut`, `maintain`, `gain`, `custom`. Do not invent a goal weight, target pace or target calories.

## Weekly review

```sql
select private.generate_weekly_review(p_week_end);
```

Report data coverage separately from the values calculated from available logs. Missing data is unknown; it is not zero.

## Adaptive calorie calibration

```sql
select private.generate_target_recommendation(p_end_date,p_lookback_days);
```

Recommendations are never silently applied. After explicit approval:

```sql
select private.accept_target_recommendation(p_recommendation_id,p_request_id);
```

If rejected:

```sql
select private.dismiss_target_recommendation(p_recommendation_id,p_request_id);
```

## Reminders

```sql
select private.set_reminder_preferences(p_patch,p_request_id);
```

Actual ChatGPT automation delivery is separate and should only be scheduled when the user provides or accepts a concrete cadence/time.

## Confirmation policy

Do not ask for routine confirmation when logging is clear. Clarify only when ambiguity could materially change the record, such as an unclear portion eaten, major unknown oils/sauces, multiple plausible memories, or goal/target decisions that should not be guessed.

## Response after writes

Keep confirmations compact, then query fresh canonical context again. Always use the current database targets and totals rather than assuming them from conversation history.

## Security

- Authenticated browser sessions are SELECT-only for Diet Copilot tables.
- Owner-scoped RLS uses `auth.uid() = user_id`.
- Private write helpers are executable only by privileged server roles, not browser roles.
- `private.resolve_owner()` maps privileged ChatGPT/operator writes to the configured Diet owner.
- Realtime publication may expose dashboard tables only through the same owner-scoped RLS.

## Legacy-backend rule

`mrrqsqawwxwebsdmrnre` is a historical snapshot only. Do not synchronize new data into it, do not use its saved-food IDs, and do not repair it in parallel with production. All new activity belongs exclusively in `hycegznamzjhwinegaai`.
