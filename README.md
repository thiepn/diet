# Diet Copilot — Read-only Dashboard

Diet Copilot is a **ChatGPT-controlled nutrition log** with a read-only web dashboard.

The product boundary is intentional:

```text
You → ChatGPT → Supabase → Dashboard
```

- **ChatGPT** interprets meals/photos, estimates calories and protein, logs weight, and performs corrections.
- **Supabase** is the durable source of truth.
- **This website** only displays the resulting history and trends.

The website is **not** a manual calorie tracker and intentionally contains no meal-entry, macro-entry, saved-food, or weight-entry UI.

## Dashboard views

### Today
- calories consumed / target / remaining
- protein consumed / target
- latest body weight
- meals and their item breakdowns
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

## Read-only guarantee

The browser client does not call Supabase insert/update/delete APIs and does not invoke write RPCs. Its only persistent writes are local browser connection/cache settings.

Nutrition records are read from these existing schema-v5 tables:

- `profiles`
- `daily_logs`
- `meals`
- `meal_items`
- `weight_entries`

The existing authenticated ChatGPT RPC layer remains in Supabase for external logging/correction workflows.

## Private connection

Because diet data is private and protected by RLS, the dashboard still needs a Supabase project URL, publishable/anon key, and an authenticated user session. These controls are infrastructure setup only; they do not edit nutrition data.

The dashboard reuses the existing `diet-copilot-cloud-config` key, so an already configured V1 client can reconnect without changing the database schema.

## Offline behavior

After a successful cloud refresh, the dashboard stores a read-only browser snapshot. If the device is offline, that snapshot remains viewable until the next refresh.

Existing V1 local state is migrated once into this read-only cache so previous data is not hidden during the frontend transition.

## Supabase

No database migration is required from the previous schema-v5 release.

The existing files in `supabase/` remain authoritative for the ChatGPT data bridge and database setup.

## Development

There is no build step.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Product rule

> The user should never need to manually log food on the website.

If a future feature violates that rule, it belongs in the ChatGPT interaction layer instead of the dashboard.
