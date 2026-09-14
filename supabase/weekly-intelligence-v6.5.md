# Diet Copilot V6.5 — Weekly Intelligence & Adaptive Coaching 2.0

V6.5 turns existing logged data into conservative plan-level coaching. It does not add any manual food logging workflow to the dashboard.

## Core helpers

### Trend confidence

```sql
select private.get_trend_confidence(p_end_date, p_days);
```

Returns weight-trend confidence plus intake-data uncertainty. Weight is classified as `building_baseline`, `emerging`, `established`, `noisy`, or `possible_plateau`. The helper compares multiple time windows instead of interpreting a few flat days as a plateau.

### Adaptive plan decision

```sql
select private.get_adaptive_plan_decision(p_end_date, p_lookback_days);
```

Possible decisions include:

- `need_more_data`
- `keep_target`
- `observe_another_week`
- `consider_increase`
- `consider_decrease`
- `prepare_maintenance`
- `transition_maintenance`
- `disabled`

The decision uses all logged intake days, regression-based weight trend, intake uncertainty, calorie consistency, desired pace, goal proximity and the active goal phase.

Guardrails:

- at least 14 logged intake days before plan calibration
- at least four weigh-ins spanning 14 days
- uncertainty can block a small apparent calorie adjustment
- target changes are conservative and capped at 150 kcal per recommendation
- a recommendation never silently changes the configured calorie target
- maintenance-transition logic takes priority near the goal

### Weekly intelligence

```sql
select private.get_weekly_intelligence(p_week_end);
```

Returns:

- current seven-day metrics
- previous seven-day metrics
- week-over-week changes
- trend confidence
- adaptive plan decision
- goal forecast / ETA context
- maintenance-transition context
- descriptive associations such as weekday/weekend or exact-vs-estimated patterns when enough observations exist

Associations are explicitly descriptive. They must not be presented as causal findings.

## Persisted weekly review

```sql
select private.generate_weekly_review(p_week_end);
```

The saved weekly-review payload now contains the V6.5 intelligence fields in addition to the familiar calorie, protein, fiber, weight and adherence metrics.

## Persisted target recommendation

```sql
select private.generate_target_recommendation(p_end_date, p_lookback_days);
```

Only an actual calorie-change proposal becomes `pending`. A `keep_target`, observation, or maintenance-transition result is stored as `advisory`; insufficient evidence remains `insufficient`.

Only `pending` recommendations can be accepted. Acceptance still requires an explicit user decision.

## Product boundary

The user should keep logging by simply talking to ChatGPT. V6.5 adds analysis, not work:

- no questionnaire
- no week-complete button
- no manual adherence score
- no food-entry form
- no automatic calorie-target change

The dashboard remains a read-only status, analytics and guidance surface.
