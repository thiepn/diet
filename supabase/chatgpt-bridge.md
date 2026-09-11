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

Before answering questions such as “how much can I still eat?”, “how did I do this week?”, or “same yogurt as last time”, read the database rather than relying on conversational memory.

## Context

```sql
select private.get_context(p_end_date, p_days);
```

Context now includes:

- calorie / protein / fiber targets
- goal weight and desired weekly weight change
- adaptive-target settings
- reminder/display preferences
- active goal phase
- recent day totals and completion states
- recent weight
- today's meals and item macros
- food memory
- meal memory
- latest weekly review
- latest adaptive-target recommendation

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

Each item can contain:

```json
{
  "name": "Milbona High Protein Joghurt Erdbeere",
  "quantity": "200 g cup",
  "calories": 142,
  "protein": 20,
  "carbs": 13.4,
  "fat": 0.6,
  "fiber": 0.2,
  "brand": "Milbona",
  "barcode": null,
  "confidence": "high",
  "source": "nutrition_label"
}
```

Use macros only when actually known or reasonably estimated. Do not invent carbs/fat/fiber merely because the columns exist.

Exact sources (`nutrition_label`, `weighed`, `manual_exact`) are automatically promoted into reusable food memory.

`p_request_id` should be stable across retries of one logical instruction.

### Photo meals

Photo-estimated meals should continue to store item estimates, calorie ranges, confidence and assumptions. The schema also supports `photo_url` / `photo_alt` metadata when a durable image URL exists. A transient ChatGPT upload should not be converted into a fake URL.

## Repeat-food memory

Search exact/reusable foods first when the user says things like:

- “same yogurt as yesterday”
- “my usual protein yogurt”
- “same Lidl salad”

```sql
select private.search_food_memory(p_query, p_limit);
```

If one result is clearly intended, reuse it directly:

```sql
select private.log_saved_food(
  p_saved_food_id,
  p_log_date,
  p_meal_type,
  p_request_id
);
```

If multiple plausible memories match, clarify rather than choosing arbitrarily.

Exact label data in memory should outrank a new AI estimate.

### Explicitly remember/update a food

```sql
select private.remember_food(...);
```

Use aliases for natural phrases the user is likely to reuse.

## Repeat-meal memory

Reusable multi-item meals are supported separately from individual foods.

```sql
select private.remember_meal(...);
select private.remember_meal_from_history(p_meal_id, p_name, p_aliases, p_request_id);
select private.search_meal_memory(p_query, p_limit);
select private.log_saved_meal(p_saved_meal_id, p_log_date, p_meal_type, p_request_id);
```

This is useful for recurring home meals or restaurant orders. Do not silently assume two vaguely similar meals are identical.

## Corrections

Search/read the meal first and keep its latest `updated_at`.

```sql
select private.update_meal(
  p_meal_id,
  p_patch,
  p_items,
  p_expected_updated_at,
  p_request_id
);
```

For item corrections, send the complete corrected item list. Macro and food-memory links are supported.

To move a meal, include `log_date` in `p_patch`.

## Delete

```sql
select private.delete_meal(
  p_meal_id,
  p_expected_updated_at,
  p_request_id
);
```

Deleting from a completed day automatically reopens that day so analytics cannot treat the edited record as finalized.

## Weight

```sql
select private.log_weight(
  p_entry_date,
  p_weight,
  p_notes,
  p_request_id
);
```

One weight exists per owner/date. A later value for the same date updates it and records the previous state in the action ledger.

## Day completion

When the user says “that's everything today”, “done eating”, or equivalent:

```sql
select private.set_day_status(p_log_date, 'complete', p_request_id);
```

To reopen explicitly:

```sql
select private.set_day_status(p_log_date, 'open', p_request_id);
```

Any later meal, meaningful correction or deletion on a completed day also reopens it automatically.

Only `complete` days belong in calorie/protein adherence averages.

## Goals and phases

Profile-level preferences/goals:

```sql
select private.update_profile_preferences(p_patch, p_request_id);
```

Supported settings include:

- goal weight
- desired weekly weight change (negative = loss, positive = gain)
- fiber target
- adaptive-target enable/minimum data
- optional carbs/fat display
- meal-photo display
- reminder preferences/timezone

Structured phases:

```sql
select private.start_goal_phase(...);
select private.end_goal_phase(...);
```

Phase types: `cut`, `maintain`, `gain`, `custom`.

Do not invent a goal weight or desired rate. Ask the user when those values are needed.

## Weekly review

```sql
select private.generate_weekly_review(p_week_end);
```

The review includes complete-day intake averages, protein consistency, fiber where coverage is complete, weigh-ins and weight change.

Incomplete days must not masquerade as low-calorie success.

## Adaptive calorie calibration

Generate a proposal:

```sql
select private.generate_target_recommendation(p_end_date, p_lookback_days);
```

Guardrails:

- adaptive calibration must be enabled
- desired weekly weight change must be set
- default minimum is 14 complete days
- at least 4 weigh-ins spanning at least 7 days
- uses weight-regression slope
- estimates maintenance from recorded intake and observed weight change
- proposed change is capped at ±250 kcal per adjustment
- rounded to 25 kcal
- absolute target clamp 1200–5000 kcal

**Never silently apply a recommendation.** Explain it and ask the user.

After explicit approval:

```sql
select private.accept_target_recommendation(p_recommendation_id, p_request_id);
```

If rejected:

```sql
select private.dismiss_target_recommendation(p_recommendation_id, p_request_id);
```

## Reminders

Database preferences are managed with:

```sql
select private.set_reminder_preferences(p_patch, p_request_id);
```

Actual ChatGPT reminder/automation delivery is separate from database preferences and should only be scheduled when the user supplies or accepts a concrete cadence/time.

Useful optional reminders:

- morning weigh-in
- end-of-day closeout
- weekly review

## Undo

```sql
select private.undo_action(p_action_id);
```

Supported action history includes meal create/update/delete, weight create/update and day-status changes. Goal/recommendation decisions should normally be changed explicitly rather than treated as a generic undo shortcut.

## Confirmation policy

Do not ask for confirmation for clear, low-risk meal/weight logging.

Clarify only when ambiguity could materially change the record, such as:

- unclear portion actually eaten
- a major unknown oil/sauce amount
- multiple historical/memory records plausibly match
- goal/rate/target decisions that should not be guessed

## Response after writes

Keep logging confirmation compact and then query current context again.

Example:

```text
Logged snack: 142 kcal · 20 g protein · 0.2 g fiber (nutrition label).
Today: 142 / 2,300 kcal · 2,158 kcal remaining.
```

## Security

Authenticated browser sessions are SELECT-only. The private write bridge is not granted to browser roles. Realtime publication is enabled for dashboard tables, but RLS still restricts which rows an authenticated client can receive.
