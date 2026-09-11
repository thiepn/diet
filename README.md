# Diet Copilot — ChatGPT-controlled Nutrition Dashboard

Diet Copilot is a **ChatGPT-controlled nutrition and weight log** with a read-only web dashboard.

Canonical app: **https://thiepn.dev/diet/**

The product boundary is intentional:

```text
You → ChatGPT → Supabase → Dashboard
```

- **ChatGPT** interprets meal text/photos, estimates calories and protein, logs weight, performs corrections, and answers questions from the stored history.
- **Supabase** is the durable source of truth.
- **The website** displays history, trends, and insights only.

The website is **not** a manual calorie tracker and intentionally contains no meal-entry, macro-entry, saved-food, or weight-entry UI.

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
- 7- and 30-day calorie averages
- protein-target consistency
- logging completeness
- exact vs estimated meal counts
- average target deviation

## Live backend

Diet Copilot uses a dedicated Supabase project:

- Project: `Diet Copilot`
- Ref: `mrrqsqawwxwebsdmrnre`
- Region: `eu-central-1`
- Organization: `Thiepn`

The dashboard is preconfigured with the project's publishable key. That key is safe for browser use; all private data is still protected by Supabase Auth and RLS.

## Read-only guarantee

Authenticated browser sessions have SELECT-only database access to their own rows.

The browser cannot INSERT, UPDATE, or DELETE meals, meal items, daily logs, weights, or AI actions, and it cannot execute the private ChatGPT write functions.

ChatGPT writes through functions in the non-exposed `private` database schema using the connected Supabase management/database integration.

## ChatGPT bridge

The live bridge supports:

- reading recent context
- searching meal history
- logging structured meals
- idempotent retries
- calorie/protein uncertainty ranges
- logging/updating weight
- correcting meals
- moving meals between dates
- deleting meals
- stale-write protection
- audit history
- undoing supported ChatGPT actions

See [`supabase/chatgpt-bridge.md`](supabase/chatgpt-bridge.md) for the operational contract.

## Account model

The current installation is intentionally single-user. A Supabase Auth account is required for the dashboard, and the private ChatGPT bridge refuses to resolve an owner if multiple Diet Copilot Auth users exist.

## Offline behavior

After a successful cloud refresh, the dashboard stores a read-only browser snapshot. If the device is offline, that snapshot remains viewable until the next refresh.

## Development

There is no build step.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Product rule

> The user should never need to manually log food on the website.

If a future feature violates that rule, it belongs in the ChatGPT interaction layer instead of the dashboard.
