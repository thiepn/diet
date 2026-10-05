# P30 — Onboarding, Goals & Phase Setup

P30 gives a new or reset Diet Copilot account a short path from zero context to a usable, explicit starting plan.

## Completion rule

Onboarding is considered complete only when the owner-scoped read model has:

- a current weight;
- a profile;
- an active goal phase;
- a valid calorie target;
- a valid protein target.

There is no separate hidden “onboarding completed” flag. If the underlying plan is incomplete, the setup prompt returns automatically.

## First-run experience

When a signed-in live account is missing setup, Diet Copilot shows a Today banner and opens the setup flow once per browser session.

The flow is resumable and non-blocking. **Do this later** closes the dialog for the current session, but the Today banner remains.

### Step 1 — Starting point

The user supplies current body weight.

A single weigh-in is enough to initialize the plan. Trend weight and expenditure remain explicitly low-confidence until more evidence is collected.

### Step 2 — Goal phase

The user chooses:

- Lose
- Maintain
- Gain

For loss/gain, goal weight and weekly rate are explicit. Maintenance uses the current weight and a zero weekly rate.

The default pace is deliberately moderate:

- loss: roughly 0.5% of body weight per week, capped at 0.5 kg/week;
- gain: roughly 0.25% of body weight per week, capped at 0.25 kg/week;
- maintenance: 0 kg/week.

The user can edit the rate before saving.

### Step 3 — Starting targets

Diet Copilot proposes editable starting values.

The calorie estimate uses a deliberately simple starting heuristic:

- rough maintenance: 30 kcal/kg/day;
- adjusted by the chosen weekly weight-change rate using the engine's 7,700 kcal/kg energy-density assumption;
- rounded to 25 kcal;
- clamped to the engine's 1,200–6,000 kcal operating range.

Protein defaults to 1.8 g/kg, rounded to 5 g. Fiber defaults to 30 g.

These are described as **starting estimates**, not measured expenditure. The adaptive engine still needs reliable food logs and weigh-ins before it can make evidence-backed strategy recommendations.

## Canonical onboarding transaction

P30 adds one Diet-owned RPC:

`diet_app_complete_onboarding`

It atomically:

1. upserts the owner's profile targets;
2. upserts the starting-day weight;
3. closes any currently active goal phase;
4. creates the new active goal phase;
5. aligns an already-existing daily log for the starting date;
6. records the mutation through the existing P19 idempotency ledger.

The function:

- requires a non-anonymous authenticated session;
- is `SECURITY DEFINER` with empty `search_path`;
- validates all inputs;
- has PUBLIC/anon execution revoked;
- is executable only by `authenticated`;
- remains protected by the existing Diet owner-guard triggers.

## Editing the plan later

The same flow is available from **Strategy → Current goal → Edit plan**.

Re-running it creates a new phase boundary rather than silently rewriting old phase history.

## What happens after setup

The final setup step explains what Diet Copilot will learn automatically:

- trend weight;
- reliable intake;
- expenditure;
- usual portions;
- recurring meals;
- whether the current target should stay or change.

Target changes remain explicit and reviewable; onboarding does not grant Copilot autonomous write authority.

## Next phase

**P31 — Adaptive Strategy & Weekly Review**

P31 should turn the existing deterministic adaptive engine into a clear weekly decision workflow: evidence, confidence, recommendation, why it was made, what is missing, and an explicit keep/apply action.
