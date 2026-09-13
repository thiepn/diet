# Diet Copilot

Diet Copilot is a **ChatGPT-controlled nutrition log and diet intelligence system** with a read-only web dashboard.

```text
You → ChatGPT → canonical Supabase backend → Dashboard
```

- **ChatGPT** handles meal/weight logging, corrections, photo and nutrition-label interpretation, reusable foods/meals, goals, reviews and coaching.
- **Supabase** is the durable source of truth.
- **The dashboard** displays Today, History, Trends and Insights without becoming a manual calorie-entry app.

## Production backend

Diet Copilot uses the shared **THIEPN Account** Supabase project.

- Canonical project ref: `hycegznamzjhwinegaai`
- Canonical dashboard: `https://thiepn.dev/diet/`
- Legacy project ref `mrrqsqawwxwebsdmrnre` is retired and must not receive new reads/writes from Diet Copilot.

The canonical backend is authoritative for meal IDs, saved-food IDs, weight entries, goals and all current Diet Copilot state.

## Core tracking rule

**Every available logged value counts.**

A day does not disappear from averages or trends because it is Open, Partial, or not manually finalized. Day status is coverage metadata only.

- Calories and protein use all days with logged intake.
- Weight trends use all available weigh-ins.
- Fiber uses all known fiber values; missing fiber remains unknown rather than becoming zero.
- Fiber full-coverage is reported separately from the known fiber total.
- Status completion/coverage is shown separately and never used as an exclusion rule.
- Missing meals or nutrients are not invented.

This makes Diet Copilot a low-friction tracker rather than a compliance/closeout system.

## Low-friction logging

- text or photo-based meal logging through ChatGPT
- exact nutrition-label values when available
- calorie ranges and confidence for estimates
- weight logging and corrections
- automatic Realtime dashboard refresh
- stable request IDs for idempotent writes and safe retries

Every ChatGPT write is directed to the canonical project, verified after the write, and must not be mirrored to a second backend.

## Food and meal memory

- exact packaged foods can be remembered automatically
- aliases support phrases such as “same protein yogurt”
- verified remembered values outrank a fresh estimate
- reusable multi-item meals can be saved and recalled
- portion-aware reuse supports half portions, multipliers and changed gram amounts
- memory remains ChatGPT-managed; there is no manual food-database UI

## Nutrition

- calories are the primary metric
- protein is first-class
- fiber is the third core nutrition metric when data is available
- carbs and fat can be stored when known but remain optional/hidden by default
- partial fiber coverage is explicitly marked instead of treating missing fiber as zero

## Goals and phases

Supported phases:

- Cut
- Maintain
- Gain
- Custom

A phase can carry calorie, protein and fiber targets plus an optional goal weight and desired weekly weight-change rate.

## Adaptive calorie calibration

After enough logged intake and weight-trend data, Diet Copilot can estimate whether the calorie target should change.

Guardrails:

- desired weekly weight-change rate must be configured
- default minimum is 14 logged intake days
- at least four weigh-ins spanning at least seven days
- regression-based weight trend rather than a single weigh-in
- suggested changes capped to ±250 kcal at a time
- targets rounded to 25 kcal
- recommendations are **never silently applied**

## Smart Diet Coach

Diet Copilot can interpret:

- observed weight pace vs planned pace
- plateau / slower / faster / on-pace status after enough data exists
- goal ETA
- calorie/protein/fiber consistency
- maintenance-transition context near the end of a cut or gain
- data coverage separately from the nutrition values themselves

Early weight data is shown as **Building baseline** rather than over-interpreted.

## Metrics

Insights support 7D / 28D / 90D views for:

- average calories across logged intake days
- calorie hit rate within ±150 kcal
- average protein and protein target-hit rate
- known fiber average and target-hit rate
- fiber full-coverage count
- trend weight and observed pace
- goal progress and ETA
- exact/reused vs estimated meals
- status coverage
- combined plan adherence
- estimated maintenance when enough data exists

## Weekly review

Weekly reviews use all available logged intake and can report:

- logged-day coverage
- status-complete coverage separately
- average calories
- average protein
- average known fiber
- calorie / protein / fiber adherence
- weigh-ins and weight change
- observed pace vs planned pace
- goal ETA and maintenance-transition context

## Meal photos

Meals support optional durable photo URLs and thumbnails. The UI does not expose upload controls; photos remain part of the ChatGPT logging workflow when durable image storage is available.

## Reminders

Diet Copilot stores opt-in preferences for:

- weigh-in reminders
- end-of-day reminders
- weekly review reminders

Actual ChatGPT notifications are scheduled separately.

## Dashboard

### Today

- calories consumed / target / remaining
- protein progress
- fiber progress and coverage
- weight
- optional day-status metadata
- goal progress
- optional carbs/fat summary
- expandable meal cards

### History

- 3 / 7 / 14 / 30 / 90 day and all-time ranges
- calories, protein, weight and status metadata
- meal-level details

### Trends

- Weight / Calories / Protein / Fiber
- 7D / 30D / 90D / 6M / All
- weight regression and moving trend
- target lines and logged-data averages

### Insights

- Key Stats with 7D / 28D / 90D ranges
- Smart Diet Coach
- current goal phase
- weekly-review context
- adaptive-calibration status
- food-memory status

## Product rule

> The user should never need to manually log food on the website.

If a feature would turn the dashboard into a conventional entry form, it belongs in the ChatGPT layer instead.

## Read-only browser guarantee

Authenticated browser sessions have owner-scoped SELECT access to Diet Copilot data. Privileged writes live behind private server-side helpers. Realtime publication remains protected by owner-scoped RLS.

## Offline behavior

After successful online use, the app caches its static shell and latest read-only snapshot. Supabase database/Auth/Realtime responses are never service-worker cached.

## Development

There is no build step.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.
