# Diet Copilot 2.0 — P1.5 Legacy Data Adapter & Shadow Validation

Status: **implemented and live-shadow-validated on `diet-copilot-2.0`**

Production authority remains Diet Copilot V1. No production database rows, schema, RLS policies, RPCs, UI, or deployed bundles are changed by P1.5.

## Goal

P1.5 proves that the new P1 adaptive engine can consume the existing Diet Copilot data model safely before any UI or production cutover.

It provides:

- a read-only legacy-data adapter,
- a repeatable V1-versus-P1 comparison,
- safety gates,
- synthetic regression fixtures,
- live historical shadow validation,
- no persistence of private nutrition history in Git.

## Files

- `src/engine/legacy-data-adapter.mjs`
- `src/engine/shadow-validation.mjs`
- `scripts/p1_5-shadow-validate.mjs`
- `supabase/tests/p1_5_shadow_snapshot.sql`
- `tests/legacy-shadow.mjs`

## Legacy status correction

Diet Copilot V1 explicitly treated `open`, `partial`, and `complete` as coverage metadata while still including logged nutrition in statistics.

Therefore P1.5 must **not** translate old `partial` rows directly into P1's stronger semantic meaning of "known incomplete intake."

Adapter policy:

- legacy `complete` -> P1 `complete`
- legacy `excluded` / `ignore` -> P1 `excluded`
- legacy `open` -> no explicit P1 coverage label
- legacy `partial` -> no explicit P1 coverage label

Unlabelled legacy rows are then conservatively re-evaluated by the P1 engine using:

- whether the day is historical/closed,
- meal count,
- intake plausibility relative to established logging,
- logged calorie uncertainty.

This prevents both failure modes:

1. treating an obviously incomplete one-meal day as a valid full day;
2. throwing away an older `partial` day that actually contains plausible full-day intake.

## Initial TDEE prior

V1 does not persist a canonical expenditure estimate in `profiles`.

P1.5 therefore derives a transparent starting prior from the existing target and goal rate:

```text
implied TDEE = current calorie target
             - desired weekly weight change * 7700 / 7
```

The adapter records the source as:

`implied_by_current_target_and_goal_rate`

This value is only an initialization prior. P1 then updates it from observed trend weight + reliable intake.

## P1 refinement discovered by shadow validation

The first live shadow run exposed a calibration mismatch:

- there were enough plausible historical intake rows to calculate a tentative expenditure signal,
- but calorie uncertainty reduced them to fewer than 10 fully-effective days,
- the original P1 hard gate therefore returned no expenditure estimate at all.

That was unnecessarily binary.

P1 was refined to distinguish **estimate availability** from **adjustment confidence**.

New defaults:

- at least 10 plausible non-zero-reliability intake rows,
- at least 4 effective intake days,
- at least 14 days of weight span,
- at least 4 observed weigh-ins,

are enough to create a tentative TDEE estimate.

But confidence is capped by effective intake evidence:

- <4 effective days -> `building_baseline`
- 4–<8 -> at most `low`
- 8–<12 -> at most `medium`
- 12+ can reach `high` if the overall score also qualifies.

This allows Diet Copilot to learn from messy legacy history without letting low-quality intake trigger calorie changes.

## Shadow safety gates

`shadowGate()` currently requires:

1. low/building confidence cannot produce an active calorie adjustment;
2. an applied target step cannot exceed 150 kcal;
3. deterministic adapter metadata must be present.

A material difference between V1 and P1 TDEE point estimates does **not** fail the gate by itself. The engines intentionally use different weight/noise handling. What matters before cutover is whether P1 behaves safely under disagreement.

## Live validation

A read-only live shadow run was performed against the canonical shared Supabase project on 2026-09-29.

No raw nutrition or bodyweight values were committed.

Current-checkpoint result:

- shadow gate: **PASS**
- classification: **aligned_hold**
- V1: insufficient/noisy evidence -> hold
- P1: tentative expenditure available, but confidence remains low -> hold
- current calorie target: unchanged
- P1 active adjustment at low confidence: **none**
- P1 step bound: **passed**

The two engines produced materially different expenditure point estimates. This is expected because:

- V1 regresses raw scale weight,
- P1 first builds robust trend weight,
- P1 downweights uncertain intake,
- P1 starts from an explicit prior and rate-limits state movement.

Because confidence was low, this disagreement did not propagate into a target change.

## Historical cutoff matrix

Seven read-only historical checkpoints were evaluated.

Result:

- **7 / 7 shadow safety gates passed**
- early checkpoints stayed in baseline-only mode because weight span was insufficient
- once sufficient weight span existed, P1 created a tentative estimate
- P1 still held the calorie target because effective intake evidence remained too weak
- no historical checkpoint produced a low-confidence active calorie adjustment

This confirms the current behavior is not dependent on a single day's output.

## Privacy

The repository contains:

- transformation code,
- read-only SQL query text,
- tests with synthetic data,
- aggregate validation conclusions.

It does **not** contain:

- real meal history,
- real scale-weight history,
- user IDs,
- raw profile rows,
- exported shadow snapshot files.

The SQL snapshot result must remain local/transient.

## Repeatable workflow

1. Run `supabase/tests/p1_5_shadow_snapshot.sql` against the canonical project.
2. Save only the returned JSON locally.
3. Run:

```bash
node scripts/p1_5-shadow-validate.mjs /path/to/private-shadow-snapshot.json
```

4. Review:
   - V1 decision,
   - P1 decision,
   - target difference,
   - TDEE difference,
   - confidence,
   - warnings,
   - safety gate.
5. Delete the local snapshot when no longer needed.

## Cutover rule

P1 remains non-authoritative.

Do not replace V1 target decisions until:

- enough new high-quality Diet 2.0 intake data exists,
- P1 reaches medium/high confidence under normal use,
- repeated shadow runs show no unsafe oscillation,
- migration/data-integrity tests pass,
- P2/P3 UI clearly communicates confidence and recommendation rationale.

## P1.5 result

**PASS.**

The legacy data can be safely adapted into the P1 engine, real historical behavior is conservative, and production remains unchanged.
