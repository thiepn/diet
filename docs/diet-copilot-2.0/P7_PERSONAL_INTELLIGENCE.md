# Diet Copilot 2.0 — P7 Personal Intelligence

Status: **implemented on `diet-copilot-2.0`**

P7 turns existing Diet Copilot history into deterministic personal patterns without creating another source of truth.

The core rule is:

> **Code calculates the pattern. AI may explain it later, but AI does not calculate or decide it.**

## Product role

P7 sits above the trusted P1–P6 data pipeline:

```text
food + weight + training + activity
                ↓
reliable-day classification
                ↓
P7 deterministic statistics
                ↓
personal observations
                ↓
future P8 AI explanation
```

P7 does not write recommendations, targets or insight rows back to Supabase.

## Engine

Canonical source:

`src/engine/personal-intelligence.mjs`

Browser mirror:

`v2/engine/personal-intelligence.mjs`

Version:

`1.0.0-p7`

CI requires the browser mirror to remain byte-for-byte identical to the canonical source.

## Analysis window

The default P7 window is **28 days**.

The engine joins:

- P1 intake reliability,
- normalized daily calories,
- protein,
- carbohydrates,
- fat,
- fiber,
- calorie targets,
- protein targets,
- P1 trend weight,
- P6 training classification,
- Health/activity history.

## Reliable-data gate

P7 does not treat every logged day equally.

The engine reuses P1's assessed-intake reliability.

A day contributes to nutrition pattern statistics only when:

`reliability > 0`

This means obviously partial/unknown days are withheld from statistics that would otherwise become misleading.

## Macro-data gate

Legacy meal history can contain calories/protein without complete carbohydrate/fat/fiber data.

P7 therefore treats a daily macro as unknown unless at least one meal item actually contains that nutrient.

Missing carbohydrate data is **not converted into 0 g**.

This prevents fabricated training-day carbohydrate patterns.

## Personal metrics

P7 currently calculates:

### Calorie-target adherence

A reliable day counts as inside the target band when intake is within:

- ±10% of target, or
- ±100 kcal,

whichever tolerance is larger.

Output:

`calorieTargetAdherence`

### Protein adherence

A reliable day counts as protein-adherent when logged protein reaches at least:

`90% of daily protein target`

Output:

`proteinTargetAdherence`

### Calorie variability

P7 computes a robust intake variability coefficient using median absolute deviation.

Output:

`calorieVariabilityCV`

### Weekend vs weekday intake

When there is enough evidence:

- at least 2 reliable weekend days,
- at least 4 reliable weekdays,

P7 compares mean calorie intake.

Output:

`weekendDeltaCalories`

### Training-day carbohydrate pattern

Moderate and hard days are grouped as training days.

Rest days form the comparison group.

P7 requires:

- at least 2 training days with carbohydrate data,
- at least 3 rest days with carbohydrate data.

Output:

`trainingCarbDelta`

### Activity shift

P7 compares:

- the previous 7 completed activity days,
- against the preceding 14-day activity baseline.

The current calendar day is excluded because its steps/activity may still be incomplete.

Output:

`activityShift`

### Steps/intake association

When at least 8 reliable completed days have both steps and intake, P7 computes a Pearson correlation.

Output:

`stepsIntakeCorrelation`

The result is explicitly described as:

**association, not causation**

The UI also reports direction:

- positive,
- negative.

### Trend-weight pace

When enough P1 trend-weight history exists, P7 reports the approximate recent trend-weight rate in kg/week.

Output:

`weeklyTrendRate`

## Insight thresholds

P7 withholds cards when evidence thresholds are not met.

Examples:

- protein/calorie adherence: at least 6 reliable target days,
- weekend comparison: minimum 2 weekend + 4 weekday days,
- training carbohydrate comparison: minimum 2 training + 3 rest days with carb data,
- step/intake correlation: minimum 8 paired completed days,
- activity shift: minimum 4 recent + 7 baseline activity days,
- weight pace card: minimum 14 trend days.

This means a new account should display fewer observations rather than confidently inventing patterns from tiny samples.

## Confidence labels

Insight confidence is based on evidence count:

- Insufficient
- Low
- Medium
- High

This is an evidence-volume indicator.

It is not a medical confidence score and does not imply causality.

## Progress UI

P7 adds a **Personal intelligence** panel to Progress.

The compact summary includes:

- reliable intake days,
- protein adherence,
- calorie adherence,
- weight-trend pace,
- weekend calorie delta,
- activity shift.

Below that, evidence-backed cards can include:

- Calorie target consistency
- Protein target consistency
- Weekend intake difference
- Training-day carbohydrate difference
- Recent step baseline shift
- Steps and same-day intake
- Recent trend-weight pace

Each card includes:

- category,
- deterministic value,
- explanation,
- evidence-day count,
- confidence level.

## Training classification

P7 reuses P6's training context.

A day is classified from:

1. explicit per-date training override, otherwise
2. weekly template.

A skipped workout override is treated as a rest day for the pattern calculation.

Training distribution does not need to be enabled for the classification to remain useful as context.

## Partial current-day activity

P6 already treats current-day activity as an in-progress signal.

P7 goes further for statistical comparisons:

- current-day steps are excluded from step/intake correlations,
- current-day steps are excluded from activity-baseline shifts.

This avoids comparing a partially completed day against full historical days.

## Read-only architecture

P7 deliberately adds:

- **0 tables**
- **0 browser mutation RPCs**
- **0 direct table writes**
- **0 persisted insight rows**

The exact Diet browser mutation allowlist remains the P6 set of **18 RPCs**.

Derived insights are recalculated from canonical history every time the V2 read model is built.

This avoids stale insight caches and conflicting truth.

## Database contract

`supabase/tests/p7_personal_intelligence_contract.sql`

verifies:

- authenticated Diet RPC set remains exactly 18,
- no new authenticated direct table writes,
- no `personal_intelligence` / `personal_insights` canonical table,
- no public `diet_app_*insight*` mutation façade.

Live expected result:

`diet_p7_personal_intelligence_contract_ok`

## JavaScript tests

P7 adds:

- `tests/personal-intelligence.mjs`
- `tests/v2-personal-intelligence.mjs`

Coverage includes:

- protein adherence,
- calorie adherence,
- weekend intake differences,
- training-day carbohydrate differences,
- activity shift,
- step/intake correlation,
- non-causal wording,
- weight-trend rate,
- insufficient-data withholding,
- skipped training handling,
- canonical/browser engine parity,
- V2 UI contract,
- exact unchanged 18-RPC allowlist,
- read-model integration,
- macro-data preservation.

## AI boundary

P7's policy object explicitly states:

```text
calculation = deterministic_only
aiRole = explanation_only_not_calculation
correlationMeaning = association_not_causation
```

P8 can therefore answer questions such as:

- “How am I doing?”
- “Why was my weekend different?”
- “Am I eating more on high-step days?”
- “Do I actually eat more carbs on training days?”

by explaining P7's calculated evidence.

P8 should not independently recompute, invent, or silently override these metrics.

## P7 boundary

P7 does not yet implement:

- causal inference,
- workout-volume vs nutrition analysis,
- strength-performance correlations,
- sleep/recovery analytics,
- AI-generated coaching summaries,
- automatic interventions,
- predictive meal recommendations.

Those belong to later phases once their underlying canonical data exists.

## Result

P7 adds an interpretation layer without weakening the architecture:

```text
P1   calculates expenditure
P5   manages accepted strategy
P6   distributes training fuel
P7   measures personal patterns
P8   can explain those trusted patterns
```

The key invariant remains:

> **If Diet Copilot cannot support an observation with enough canonical data, it withholds the observation instead of guessing.**
