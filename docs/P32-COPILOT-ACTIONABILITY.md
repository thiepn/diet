# P32 — Copilot Actionability

P32 turns Diet Copilot from a Q&A surface into a constrained action assistant.

The operating rule is:

**understand → prepare → preview → revalidate → confirm → execute**

Copilot never gets arbitrary write access.

## Allowlisted actions

P32 allows only:

- log an exact saved food;
- log an exact saved meal;
- repeat an exact recent meal;
- navigate to Food;
- navigate to Strategy;
- open explicit goal setup;
- record **Keep current** for the deterministic weekly review;
- apply the currently actionable deterministic strategy recommendation.

Everything else is rejected by the browser validator. The remote Edge Function uses the same allowlist.

## Structured previews

Write proposals are not presented as a generic chat button.

Diet Copilot derives a preview locally from trusted data and shows what will happen.

Food previews include:

- exact saved item;
- meal type;
- portion multiplier;
- calories added;
- protein added when known;
- expected calorie remainder versus today's target.

Strategy previews include:

- current target;
- recommended target;
- calorie delta;
- effective date;
- the fact that target history is preserved.

Keep-current previews explicitly show that the calorie target remains unchanged and only the review outcome is recorded.

The language model does not supply these display values.

## Portion-aware logging

An explicit user multiplier such as `1.5x`, `half`, or `double` is honored within the existing 0.1×–10× safe range.

When no multiplier is stated, a saved food may use the P29 learned usual portion if that portion has already passed P29's evidence gate. Otherwise it remains 1×.

No unknown nutrition is estimated.

## Repeat actions

Requests such as “repeat yogurt breakfast again” can resolve to a known recent meal.

The proposal repeats the exact stored meal. Modified meals still route to Food for explicit review.

## Strategy actions

P32 does not calculate a strategy recommendation.

It consumes P31.

### Keep current

When a current target exists, Copilot can prepare **Keep current**.

Confirmation records the weekly review without changing calories.

### Apply

`strategy_apply` is valid only when P31 marks the current deterministic recommendation actionable.

The Copilot action carries a guard containing:

- as-of date;
- engine version;
- decision;
- current target;
- recommended target.

Before confirmation the browser validates that guard against fresh context.

P31's executor then validates it again before and after creating the immutable review snapshot.

If anything changed, the action fails closed as stale.

The existing Today/Tomorrow effective date semantics and target-history preservation remain intact.

## Goal changes

Copilot cannot directly set goal weight, goal mode or pace.

It may only open P30's explicit goal setup. The user still reviews and saves that form themselves.

## Food freshness guards

A prepared food action carries the candidate ID and trusted calorie/protein values used for the preview.

If that saved item's nutrition changes before confirmation, the proposal is rejected as stale.

## Remote AI boundary

The authenticated `diet-copilot-ai` Edge Function is now source-controlled under:

`supabase/functions/diet-copilot-ai/index.ts`

The function:

- requires a valid JWT;
- receives only the compact derived context;
- cannot execute Diet writes;
- may return at most one allowlisted proposal;
- strips unsupported action types;
- validates candidate IDs/types;
- permits strategy apply only when trusted context explicitly says the P31 recommendation is actionable.

The browser performs a second independent validation.

## No autonomous writes

Every write action has `requiresConfirmation=true`.

Navigation actions do not write and may execute immediately.

There is no hidden background application of food logs, target changes, goal changes, or recommendations.

## Next phase

**P33 — Progress, Trends & Visual Analytics**

P33 should make the core signals easier to interpret visually: trend weight, adherence, expenditure, goal trajectory, phase progress, confidence and data coverage.
