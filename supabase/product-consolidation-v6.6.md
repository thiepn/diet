# Diet Copilot V6.6 — Product Consolidation & Intelligent UX

V6.6 is a consolidation release. It does not add another nutrition-tracking workflow. The product boundary remains:

```text
User → ChatGPT → canonical Supabase backend → read-only dashboard
```

## Today remains core-only

The Today tab is reserved for current status, meals, and useful passive guidance. V6.6 explicitly removes legacy Quick Capture, the extra Today activity tile, and the obsolete day-close hint. The dashboard must not become a manual logging surface.

## One coherent Insights page

Earlier releases accumulated separate sections for Smart Coach, Key Stats, Health Connect, recipes, Food Intelligence and Weekly Intelligence. V6.6 replaces the final Insights renderer with one hierarchy:

1. This week / plan decision
2. Nutrition
3. Weight & goal
4. Food intelligence
5. Data quality and supporting activity context

The underlying V6.2–V6.5 intelligence remains available; only presentation is consolidated.

## Metric provenance

Important metrics expose a read-only “How calculated” detail. Provenance states what data contributes and which rules are applied.

Core rules:

- calorie and protein metrics use every day with logged intake;
- Open / Partial / Complete is coverage metadata only;
- fiber uses every known fiber value and reports full coverage separately;
- weight pace waits for enough weigh-ins and time span;
- goal progress uses the active phase baseline and trend weight;
- adaptive coaching remains recommendation-only.

## Standardized confidence

V6.6 uses four user-facing confidence states:

- **High** — nutrition is mostly exact/reused with narrow stored estimate ranges, or the weight trend is established;
- **Moderate** — usable evidence with some uncertainty, or an emerging weight trend;
- **Low** — estimate uncertainty is large or the weight evidence is noisy;
- **Building** — too little evidence for a mature interpretation.

Confidence is metadata about evidence quality. Low confidence does not exclude logged intake from totals or averages.

## History quality filters

History adds lightweight `All / Exact / Estimated` filters. These filters change only the visible meal rows. They never recalculate or hide part of a day total.

Exact/reused sources are:

- `nutrition_label`
- `weighed`
- `manual_exact`
- `saved_food`
- `saved_meal`
- `saved_recipe`

Estimated sources remain valid logged intake and are shown with stored confidence/range context when available.

## Trends maturity

The Trends screen preserves the selected metric and time range across sessions and adds an evidence-confidence banner. Early datasets are explicitly described as early/building rather than visually implying a mature trend.

## Single-pass refresh

Before V6.6, successive versions wrapped `refreshData()` to fetch base data, V6 extras, V6.3 food portions and V6.5 plan state separately. V6.6 replaces the final refresh function with one request batch over the dashboard-visible tables and performs one render after the canonical snapshot is assembled.

The consolidated refresh reads:

- profile
- daily logs
- meals and meal items
- weight entries
- saved foods
- saved meals and recipe items
- goal phases
- target recommendations
- weekly reviews
- activity days
- learned saved-food portions

This does not change write authority. The browser remains SELECT-only.

## Unified Realtime

V6.6 uses one owner-scoped Realtime channel for all dashboard-visible Diet Copilot tables. The separate V6 activity channel is removed before subscribing. Events are debounced into a single silent canonical refresh.

## Detail-sheet consistency

The existing metric detail dialog remains the shared detail surface. V6.6 constrains it to the visual viewport, prevents horizontal overflow, supports safe-area insets, and adds provenance to Calories, Protein, Fiber, Weight, Goal and Progress details.

## Product invariants

V6.6 must preserve all of these:

- direct ChatGPT conversation is the logging entry point;
- no Quick Capture card on Today;
- no manual nutrition CRUD in the dashboard;
- all logged nutrition counts;
- missing values stay unknown;
- no automatic calorie target changes;
- activity does not automatically “eat back” calories;
- canonical backend is `hycegznamzjhwinegaai` only.
