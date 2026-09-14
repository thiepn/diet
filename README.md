# Diet Copilot

Diet Copilot is a **ChatGPT-controlled nutrition log and diet intelligence system** with a read-only web dashboard.

```text
You → ChatGPT → canonical Supabase backend → Dashboard
```

**Stable web release:** `1.0.0`  
**Internal milestone:** `V6.8`

## Product boundary

The dashboard is not a food-entry app. Meal and weight logging, corrections, photo/label interpretation, goals, reusable foods and coaching are handled through ChatGPT. The website displays Today, History, Trends and Insights.

The following are deliberate invariants:

- no manual food-entry form on the dashboard
- no Quick Capture workflow
- no requirement to close a day before its data counts
- no automatic activity-calorie eat-back
- no silent calorie-target changes
- hypothetical/planned food never contaminates logged intake

## Production backend

Diet Copilot uses the shared **THIEPN Account** Supabase project.

- Canonical project ref: `hycegznamzjhwinegaai`
- Production app: `https://thiepn.dev/diet/`
- Retired Diet project: `mrrqsqawwxwebsdmrnre`

The retired project must receive no Diet Copilot reads or writes.

Authenticated browser sessions are owner-scoped and read-only. Privileged mutations use private backend helpers with stable request IDs, idempotent retry and post-write verification.

## Tracking policy

**Every available logged value counts.** Day status is coverage metadata only.

- Calories and protein use every day containing logged intake.
- Weight analysis uses every available weigh-in.
- Fiber uses every known fiber value.
- Missing fiber remains unknown rather than becoming zero.
- Full fiber coverage is reported separately.
- Estimated meals count normally; uncertainty changes confidence, not inclusion.
- Legitimately repeated identical foods remain separate records.

## Intelligence

The stable web product includes:

- uncertainty-aware daily guidance
- remembered foods, aliases and learned usual portions
- verified barcode memory
- recurring food/routine recognition
- weight-trend confidence
- week-over-week nutrition intelligence
- conservative adaptive calorie recommendations
- goal forecasting and maintenance-transition guidance
- metric provenance and standardized confidence labels
- integrity checking and exactly-once write semantics

Recommendations never change targets automatically.

## Dashboard

### Today

Calories, protein, fiber, weight, goal progress, meals and passive contextual guidance. Core metric cards open consistent detail sheets with provenance.

### History

3D / 7D / 14D / 30D / 90D / All ranges, meal expansion, source quality, uncertainty ranges, and All / Exact / Estimated filters. Filters never change day totals.

### Trends

Weight / Calories / Protein / Fiber across 7D / 30D / 90D / 6M / All. Immature datasets are explicitly labeled rather than presented as established trends.

### Insights

One consolidated hierarchy:

1. This week
2. Nutrition
3. Weight & goal
4. Food intelligence
5. Data quality

## Source layout

V6.8 removed the historical pile of root-level dashboard override files from the active source tree.

```text
src/
  auth/
  core/
  intelligence/
  operations/
  styles/
  ui/
  config.js
  release.js

archive/
  legacy-dashboard/
  legacy-build/
  legacy-tests/

scripts/
tests/
supabase/
```

Legacy files are retained under `archive/` for history only and cannot feed the production builder.

## Production bundles

GitHub Pages serves exactly one local JavaScript bundle and one stylesheet:

```text
diet-app.js
diet.css
```

They are Jekyll templates assembled from the certified source list in `scripts/build-v68.mjs`. The browser does not load the individual source fragments.

The service worker uses the stable cache generation:

```text
diet-copilot-web-v1.0.0
```

Navigation and the consolidated runtime assets are network-first, with the cached read-only shell available for degraded/offline use.

## Development

Run the certification build first:

```bash
node scripts/build-v68.mjs
node tests/policy.mjs
node tests/release.mjs
```

The GitHub Actions release pipeline additionally:

- syntax-checks all active JavaScript
- verifies the backend/product contract
- verifies deterministic bundle expansion
- runs the actual GitHub Pages Jekyll build
- validates the deployed bundle artifacts
- enforces JS/CSS size budgets

For local browser work, serve the repository through a Jekyll-compatible build or inspect the expanded `.v68-build/` artifacts produced by the build script.

## Release policy

Web `1.0.0` is the frozen stable baseline. Future web changes should be maintenance fixes or clearly justified product improvements. The next major platform work is the native Android companion and Health Connect integration.
