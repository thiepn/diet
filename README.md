# Diet Copilot

Diet Copilot is a **ChatGPT-controlled nutrition log** with a read-only web dashboard.

```text
You → ChatGPT → Supabase → Dashboard
```

- **ChatGPT** interprets meals/photos, estimates calories and protein, logs weight, and performs corrections.
- **Supabase** is the durable source of truth.
- **The website** displays the resulting history, trends, and insights.

The website intentionally contains no manual meal-entry, macro-entry, saved-food, or weight-entry workflow.

## V4 — Vibrant Light

V4 is the completed responsive redesign of Diet Copilot.

### Design

- single light-mode product identity
- warm neutral canvas and white surfaces
- coral calories / brand identity
- blue protein
- violet weight
- green success and amber estimate semantics
- consumer-app typography and iconography
- accessible semantic text colors
- mobile, tablet, compact-desktop and wide-desktop layouts

### Today

- prominent calorie summary with consumed / target / remaining
- protein progress
- latest body weight
- expandable meal cards
- exact vs estimated provenance
- uncertainty range when available
- desktop 7-day snapshot

### History

- 3 / 7 / 14 / 30 / 90 day and all-time ranges
- compact daily calorie, protein and weight summaries
- meal-level expansion
- completion state and target progress

### Trends

- separate Weight / Calories / Protein views
- 7D / 30D / 90D / 6M / All ranges
- regression-based weekly weight pace
- seven-entry moving weight trend
- calorie and protein bars against recorded targets
- long-range bar-density handling
- mouse, touch and keyboard chart details

### Insights

- weight direction
- calorie averages
- protein-target consistency
- logging completeness
- exact vs estimated meal counts

### Responsive UX

- mobile bottom navigation
- tablet multi-column layout
- desktop fixed sidebar
- desktop-specific Today, History, Trends and Insights density
- account/login experience shared across devices

### Resilience and accessibility

- friendly sign-in/network/session errors
- loading, empty, syncing and offline states
- cached read-only snapshot after successful sync
- version-pinned Supabase SDK cached separately for cold offline restore
- Supabase API/Auth/Realtime responses are never service-worker cached
- skip-to-content support
- visible keyboard focus
- reduced-motion support
- touch-sized controls

## Product rule

> The user should never need to manually log food on the website.

If a future feature violates that rule, it belongs in the ChatGPT interaction layer instead of the dashboard.

## Read-only guarantee

The authenticated browser role has **SELECT-only** access to the dashboard tables, protected by owner-scoped RLS. The browser does not call nutrition insert/update/delete APIs or privileged write RPCs.

## Offline behavior

After at least one successful online use, the app caches its static shell, version-pinned Supabase client SDK, and latest read-only dashboard snapshot. A restored local auth session can therefore reopen the saved dashboard offline. Database/API responses themselves are never cached by the service worker.

## Development

There is no build step.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.
