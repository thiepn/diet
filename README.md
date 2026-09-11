# Diet Copilot

Diet Copilot is a **ChatGPT-controlled nutrition log** with a read-only web dashboard.

```text
You → ChatGPT → Supabase → Dashboard
```

- **ChatGPT** interprets meals/photos, estimates calories and protein, logs weight, and performs corrections.
- **Supabase** is the durable source of truth.
- **The website** displays the resulting history, trends, and insights.

The website intentionally contains no manual meal-entry, macro-entry, saved-food, or weight-entry workflow.

## Current redesign: V4 — Vibrant Light

The V4 frontend redesign is being implemented in focused phases while preserving the existing data model and ChatGPT logging workflow.

### P1 — Visual Foundation

Implemented:

- single light-mode product identity
- warm neutral canvas and white surfaces
- coral calorie/brand color
- blue protein color
- violet weight color
- green success and amber estimate semantics
- larger consumer-app typography
- lighter shadows and reduced border usage
- proper SVG navigation/action icons
- removal of the `READ ONLY` badge from normal UI
- refreshed account/modal styling
- refreshed PWA theme metadata and app icon

P1 intentionally does **not** restructure the Today, History, Trends, or desktop layouts. Those are later phases.

## Product rule

> The user should never need to manually log food on the website.

If a future feature violates that rule, it belongs in the ChatGPT interaction layer instead of the dashboard.

## Dashboard views

### Today
- calories consumed / target / remaining
- protein consumed / target
- latest body weight
- meals and item breakdowns
- exact vs estimated provenance
- uncertainty range when available

### History
- 3 / 7 / 14 / 30 / 90 day and all-time ranges
- daily calories, protein, weight and status
- meal-by-meal history

### Trends
- current weight and range change
- regression-based weekly weight pace
- average calories and protein on complete days
- weight chart with seven-entry moving average
- daily calorie chart against recorded targets

### Insights
- weight direction
- calorie averages
- protein-target consistency
- logging completeness
- exact vs estimated meal counts
- average target deviation

## Read-only guarantee

The browser client does not call Supabase insert/update/delete APIs and does not invoke write RPCs. Nutrition records are written through the private ChatGPT workflow and read through authenticated RLS-protected queries.

## Offline behavior

After a successful cloud refresh, the dashboard stores a read-only browser snapshot. If the device is offline, that snapshot remains viewable until the next refresh.

## Development

There is no build step.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.
