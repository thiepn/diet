# Diet Copilot 2.0 — P1 Adaptive Nutrition Engine

Status: **implemented on `diet-copilot-2.0`, not connected to production UI/backend writes**

Engine version: `1.0.0-p1`

## Purpose

P1 creates a deterministic, UI-independent nutrition engine that turns logged intake + scale weight into:

1. robust trend weight,
2. an adaptive TDEE/expenditure estimate,
3. explicit confidence and uncertainty,
4. gradual calorie-target recommendations,
5. macro targets,
6. goal-date projections.

The engine is intentionally pure JavaScript. It performs no network calls, no database writes, and no AI inference. Given identical inputs it returns identical outputs.

## Design principles

- Raw scale weight is never used directly for calorie changes.
- Missing weigh-ins are not treated as zero and do not invalidate an otherwise useful series.
- Incomplete food days are excluded from TDEE evidence instead of being interpreted as abnormally low intake.
- Expenditure changes are rate-limited so one unusual week cannot create a huge calorie swing.
- Recommendation confidence is separate from the expenditure point estimate.
- The user remains in control: P1 recommends targets; it does not silently apply them.
- Historical outputs are recomputable because the engine version and assumptions are explicit.

## Pipeline

```text
Scale weights
  -> robust recency-weighted local regression
  -> daily trend weight

Food logs
  -> coverage classification
  -> reliability weighting

Trend weight + reliable intake
  -> rolling energy-balance observation
  -> robust bounded state update
  -> current expenditure estimate + uncertainty

Expenditure + goal rate
  -> raw calorie target
  -> confidence/deadband/step guardrails
  -> recommended calorie target
  -> macro targets + goal projection
```

## Weight trend

`buildTrendWeights()` uses a trailing 20-day robust weighted linear fit by default.

- Recent observations receive more weight (7-day half-life).
- Huber-style residual reweighting reduces the influence of outliers.
- Each daily estimate uses only information available on or before that date; future weights cannot leak backward into past estimates.
- A one-day water-weight spike therefore affects the trend much less than it affects scale weight.

This is an independent implementation. It is not a reproduction of MacroFactor's proprietary algorithm.

## Intake coverage

`assessIntakeCoverage()` classifies each day as:

- `complete`
- `likely_complete`
- `partial`
- `unknown`
- `excluded`

Explicit user/app completeness signals always win. If no explicit signal exists, the engine can conservatively infer `likely_complete` from a closed day with multiple meals and a plausible total relative to established intake.

TDEE evidence weights:

- `complete`: 1.00
- `likely_complete`: 0.75 before uncertainty penalty
- `partial`: 0
- `unknown`: 0
- `excluded`: 0

This prevents a forgotten dinner from being interpreted as a sudden metabolic decrease.

## Expenditure estimator

For each eligible day, the engine looks back 20 days by default.

It estimates:

```text
stored-energy change/day = trend-weight rate * energy density
TDEE observation = reliable average intake - stored-energy change/day
```

P1 deliberately keeps the energy-density assumption explicit and configurable. Default:

- `7700 kcal/kg`

This is a simplifying V1 assumption rather than pretending body-composition partitioning is known exactly. A future engine version can replace it without changing historical raw data.

The rolling observations feed a bounded adaptive state:

- confidence-dependent update gain,
- persistence increases responsiveness to sustained changes,
- maximum ordinary movement defaults to **50 kcal/day**,
- isolated extreme observations therefore cannot instantly swing the TDEE estimate.

## Confidence and uncertainty

The confidence score combines:

- reliable intake coverage,
- weigh-in density,
- time span,
- trend stability.

Levels:

- `building_baseline`
- `low`
- `medium`
- `high`

The engine also returns `uncertaintyKcal` and a current `rangeLow` / `rangeHigh`. The interval is an operational uncertainty band, not a clinical confidence interval.

## Calorie recommendations

`recommendCalories()` calculates:

```text
raw target = estimated TDEE + desired weekly weight change * 7700 / 7
```

Then applies guardrails:

- low/building confidence -> hold current target,
- <50 kcal difference -> keep target,
- medium confidence -> max 100 kcal step,
- high confidence -> max 150 kcal step,
- targets rounded to 25 kcal,
- goal within 1.5 kg -> prepare maintenance,
- goal within 0.3 kg -> transition to maintenance.

All thresholds are centralized in `DEFAULT_CONFIG` and can be tuned by later validation rather than being scattered through UI code.

## Macro targets

`computeMacroTargets()` is deliberately simple and configurable.

Defaults:

- protein: 1.8 g/kg
- fat: 0.7 g/kg
- carbohydrate: remaining calories

Explicit protein/fat floors or per-kg values override defaults. P1 does not claim these defaults are mandatory; they are product defaults that can be personalized later.

## Goal projection

`projectGoal()` calculates a date from current trend weight and the selected target rate. Output is explicitly labelled `projection_not_guarantee`.

## Automated fixture coverage

`tests/adaptive-engine.mjs` validates:

- stable maintenance,
- slow cut,
- fast cut,
- gain/surplus,
- one-day water spike,
- sparse/missed weigh-ins,
- explicitly partial food logging,
- forgotten dinner protection,
- sudden activity increase,
- sudden activity decrease,
- true plateau during a cut,
- low-confidence hold,
- high-confidence bounded adjustment,
- goal change from cut to maintenance,
- near-goal maintenance transition,
- uncertainty-range output,
- macro-calorie closure,
- goal projection direction,
- deterministic full-engine replay.

## P1 boundaries

P1 intentionally does **not**:

- alter production tables,
- alter production RLS,
- replace the existing V1 backend SQL functions,
- change the public UI,
- auto-apply recommendations,
- incorporate step/training modifiers yet,
- use AI to calculate nutrition targets.

These boundaries make P1 testable independently before data migration or UI integration.

## Next integration gate

Before P2 UI work consumes P1, add a read-only adapter that maps the legacy Diet tables into the engine input contract and run shadow comparisons against the existing production coaching outputs. The old engine should remain authoritative until those comparisons and migration tests pass.
