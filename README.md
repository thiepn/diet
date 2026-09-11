# Diet Copilot

Diet Copilot is a **ChatGPT-controlled nutrition log and diet intelligence system** with a read-only web dashboard.

```text
You → ChatGPT → Supabase → Dashboard
```

- **ChatGPT** handles logging, photo/label interpretation, corrections, day completion, reusable foods/meals, goals and coaching workflows.
- **Supabase** is the durable source of truth.
- **The dashboard** displays Today, History, Trends and Insights without becoming a manual calorie-entry app.

## V5 — Diet Intelligence

V5 builds on the completed Vibrant Light V4 redesign without changing the core product boundary.

### Low-friction logging

- text or photo-based meal logging through ChatGPT
- exact nutrition-label values when available
- uncertainty ranges for estimates
- weight logging and corrections
- automatic Realtime dashboard refresh

### Day completeness

- days can be explicitly marked **Complete**, **Open** or **Partial** through ChatGPT
- completed days are the only days used for adherence/intake averages
- a later meal, correction or deletion automatically reopens a completed day

### Food and meal memory

- exact packaged foods are remembered automatically
- aliases support phrases such as “same protein yogurt”
- exact remembered values outrank a fresh AI estimate
- reusable multi-item meals can also be saved and recalled
- memory remains ChatGPT-managed; there is no manual food database UI

### Nutrition

- calories remain the primary metric
- protein remains first-class
- fiber is now tracked as the third core nutrition metric when data is available
- carbs and fat are stored when known but remain optional/hidden by default
- fiber coverage is marked partial when some meals lack fiber data rather than pretending the missing values are zero

### Goals and phases

Diet Copilot supports structured phases:

- Cut
- Maintain
- Gain
- Custom

A phase can carry calorie, protein and fiber targets plus an optional goal weight and desired weekly weight-change rate.

### Adaptive calorie calibration

After enough trustworthy data, Diet Copilot can estimate whether the calorie target should change.

Guardrails:

- requires a desired weekly weight-change rate
- requires at least 14 complete days by default
- requires at least four weigh-ins spanning at least seven days
- uses weight-regression trend rather than a single weigh-in
- suggested adjustments are capped to ±250 kcal at a time
- targets are rounded to 25 kcal
- **recommendations are never silently applied**

ChatGPT must explain a recommendation and receive explicit approval before applying it.

### Weekly review

Weekly summaries can report:

- complete-day coverage
- average calories
- average protein
- average fiber when coverage is complete
- protein target consistency
- weigh-ins and weight change

### Meal photos

Meals support optional durable photo URLs and thumbnails. The UI does not expose upload controls; photos remain part of the ChatGPT logging workflow when durable image storage is available.

### Reminders

Diet Copilot stores opt-in preferences for:

- weigh-in reminders
- end-of-day closeout reminders
- weekly review reminders

Actual ChatGPT notifications are scheduled separately only after a user chooses a cadence/time.

## Dashboard

### Today

- calories consumed / target / remaining
- protein progress
- fiber progress/coverage
- weight
- open/complete/partial day status
- optional goal strip
- optional carbs/fat summary
- expandable meal cards
- optional meal thumbnails

### History

- 3 / 7 / 14 / 30 / 90 day and all-time ranges
- calories, protein, weight and completion state
- meal-level details

### Trends

- Weight / Calories / Protein / Fiber
- 7D / 30D / 90D / 6M / All
- weight regression and moving trend
- target lines and complete-day averages

### Insights

- weight direction
- calorie/protein consistency
- logging completeness
- estimate quality
- current goal phase
- 7-day review
- adaptive-calibration status
- food-memory status

## Product rule

> The user should never need to manually log food on the website.

If a feature would turn the dashboard into a conventional entry form, it belongs in the ChatGPT layer instead.

## Read-only guarantee

The authenticated browser role has SELECT-only access to dashboard, memory, goal, recommendation and review tables, protected by owner-scoped RLS. Privileged writes live in the private ChatGPT bridge.

Realtime publication is enabled for dashboard-visible tables; RLS still restricts rows delivered to authenticated clients.

## Offline behavior

After successful online use, the app caches its static shell, pinned Supabase client SDK and latest read-only snapshot. Supabase database/Auth/Realtime responses are never service-worker cached.

## Development

There is no build step.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.
