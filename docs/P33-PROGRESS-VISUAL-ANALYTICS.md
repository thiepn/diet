# P33 — Progress, Trends & Visual Analytics

P33 turns the existing Progress page from a set of raw charts into a decision-useful visual review.

It remains a **read-only, deterministic product phase**. No database migration, new RPC, background write or AI calculation is added.

## What P33 adds

### Range-aware summary

The selected 4W / 3M / 6M / 1Y window now produces the same set of deterministic summary signals:

- trend-weight change;
- observed weekly weight pace;
- calorie-target adherence;
- current adaptive expenditure;
- evidence coverage.

The summary changes with the selected range instead of mixing fixed-window statistics with a different chart window.

### Correct time geometry

P33 line charts place points by their real date.

This fixes the old behavior where sparse raw weigh-ins could be spaced by array index and therefore visually misalign with the daily trend series.

Raw scale weight remains visually secondary to trend weight.

### Intake compression

Short ranges keep daily intake bars.

Longer ranges aggregate intake into weekly averages so 3–12 months remain readable instead of collapsing into hundreds of narrow bars.

### Pace interpretation

Observed trend pace is compared only with the deterministic goal pace already owned by the adaptive engine.

The result is one of:

- building;
- on pace;
- faster than planned;
- slower than planned;
- moving away from target pace;
- maintenance range.

No AI decides these labels.

### Goal trajectory

The trajectory card now joins:

- current trend weight;
- goal weight;
- remaining distance;
- movement toward the goal inside the selected range;
- observed pace versus selected pace;
- the existing adaptive projection when one is available.

Projection remains explicitly non-guaranteed.

### Weekly signal

Recent weekly intake is summarized into a compact visual list with:

- average calories;
- average target;
- variance;
- target-band adherence;
- logged-day count.

This is intended to expose consistency and direction without turning Progress into another food-log screen.

## Evidence semantics

Evidence coverage is not a medical or statistical confidence interval.

It is a UI-level completeness signal derived from:

- days with intake data;
- weigh-in count;
- available trend span.

It is labeled Strong / Useful / Partial / Sparse and is shown separately from the adaptive engine's own strategy confidence.

## Architecture

New pure module:

- `v2/p33-progress-analytics.mjs`

The module consumes the existing v2 read model and derives only display analytics for the selected range.

The production data loader remains owner-scoped and unchanged.

## Safety boundary

P33:

- performs no writes;
- changes no nutrition targets;
- does not infer unlogged calories;
- does not fabricate missing weigh-ins;
- does not convert association into causation;
- does not change P31 recommendation logic;
- does not change P32 action permissions.

## Next phase

**P34 — Mobile/PWA Interaction Excellence**

P34 should harden touch ergonomics, responsive layout, install/offline behavior, mobile navigation and small-screen interaction across the now-complete core product loop.
