# P31 — Adaptive Strategy & Weekly Review

P31 turns the existing deterministic adaptive engine into a clear weekly decision workflow.

The user-facing sequence is now:

**evidence → confidence → recommendation → explanation → missing evidence → Keep / Apply**

There is no autonomous target change.

## Weekly cadence

Diet Copilot derives review cadence from actual resolved strategy-review history.

- no previous resolved review → **First review**;
- fewer than 7 days since the last resolved review → shows the next review countdown;
- 7 days → **Weekly review due**;
- later → shows how many days overdue.

The cadence is guidance, not a lockout. A user may review again earlier when their goal or data materially changes.

## Evidence readiness

The review surfaces the engine inputs required to trust a decision:

- reliable intake effective days;
- weigh-ins;
- weight-history span;
- confidence score.

The displayed thresholds mirror the adaptive engine's decision requirements:

- at least 14 days of weight span for expenditure estimation;
- at least 4 weigh-ins;
- at least 4 effective intake days for a low-confidence baseline;
- at least 8 effective intake days before medium-confidence changes are possible;
- at least 62% confidence for the medium band.

These thresholds do not override the engine. They explain why the engine is holding or acting.

## Missing evidence

When evidence is incomplete, P31 names the concrete gap, for example:

- 3 more days of weight history;
- 2 more weigh-ins;
- 4 more effective intake days;
- more consistent paired intake/weight observations.

If all displayed readiness gates are met, the review tells the user to continue normal logging rather than manufacturing additional tasks.

## Recommendation explanation

The review card separates:

1. the engine's recommendation;
2. the deterministic reason;
3. current → recommended calories;
4. expenditure and uncertainty range;
5. observed vs planned weight rate;
6. macro guidance;
7. confidence;
8. missing evidence.

Change recommendations remain bounded by the existing P1 deadband and maximum weekly target step.

## Keep / Apply

P31 removes the old user-facing **Review recommendation → stage → decide** sequence.

The visible actions are now:

- **Keep current**
- **Apply N kcal** when the engine supports an actionable change

The existing immutable review staging step still occurs internally immediately before resolution. This preserves the server-side audit snapshot without adding a redundant interaction.

If the currently staged snapshot is stale, Keep/Apply creates a fresh snapshot first and refuses to resolve it if the evidence changes during preparation.

Applying a change still supports Today/Tomorrow effective dates and retains the existing confirmation for large/maintenance transitions.

## History and undo

Resolved reviews remain in Strategy history.

The latest accepted target change can still be reverted. Revert creates a new target period rather than rewriting history.

## Architecture

P31 adds no schema and no new backend RPC.

It uses the existing canonical functions:

- `diet_app_stage_strategy_review`
- `diet_app_resolve_strategy_review`
- `diet_app_revert_strategy_review`

The weekly-review model is deterministic and lives in `v2/p31-weekly-review.mjs`.

## Next phase

**P32 — Copilot Actionability**

P32 should make the in-app Copilot capable of turning explanations into transparent, user-confirmed Diet actions while keeping deterministic calculations and explicit confirmation boundaries.
