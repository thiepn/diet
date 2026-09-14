# Diet Copilot V6.2 — Decision Engine

V6.2 turns existing Diet Copilot data into contextual guidance without changing the core product boundary.

```text
User logs directly in ChatGPT → Supabase remains source of truth → dashboard shows status, analytics and passive guidance
```

The dashboard must not add manual food-entry or quick-capture steps.

## Daily guidance

Read the current day before giving advice such as “what should I eat?”, “should I eat more?”, or “what is the main gap today?”

```sql
select private.get_daily_guidance(p_date);
```

The result contains:

- calorie / protein / known-fiber targets
- current consumed values
- remaining values
- guidance state (`over_target`, `calories_tight`, `protein_priority`, `fiber_priority`, `room_left`, `no_action_needed`, `on_track`, `no_data`)
- calorie estimate range and material-uncertainty flag
- exact/reused vs estimated meal coverage
- fiber coverage

Do not treat the point calorie estimate as exact when the stored uncertainty range is wide.

## Contextual saved-food suggestions

```sql
select private.rank_saved_foods_for_today(p_date,p_limit);
```

This ranks the owner’s existing saved foods against the current day. It is a contextual fit ranking, not a universal health score. Exact saved-food values are preferred over fresh estimates.

Useful for requests such as:

- “What should I eat now?”
- “What protein food I already eat would fit best?”
- “Give me something from my usual foods.”

Do not automatically log a suggestion.

## Comparing user-provided options

For requests such as “shake, eggs, or salad box?” or “can I eat this?”, compare the options against the current day:

```sql
select private.compare_food_options(
  '[
    {"name":"Protein shake","calories":220,"protein":35,"fiber":2},
    {"name":"4 eggs","calories":350,"protein":28,"fiber":0}
  ]'::jsonb,
  p_date
);
```

The returned `fit_score` is only a ranking for the current day. It considers projected calories, protein gap and known fiber gap. It must not be presented as a general food-quality score.

## Coaching policy

- All logged intake counts regardless of Open / Partial / Complete day status.
- Missing fiber remains unknown, not zero.
- Do not automatically “eat back” activity calories.
- Do not change calorie targets from a single day or a single weigh-in.
- Adaptive calorie changes still require the existing calibration rules and explicit user approval.
- Wide photo / restaurant estimate ranges should reduce confidence in corrective advice.
- If the user says they are full, hungry, ill, training, traveling, or gives other relevant context, that context can override a purely numeric ranking.
