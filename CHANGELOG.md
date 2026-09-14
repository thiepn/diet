# Changelog

## V6.5 — Weekly Intelligence & Adaptive Coaching 2.0 — 2026-09-14

Turns existing logged data into conservative plan-level coaching without adding any new logging workflow.

### Weekly intelligence

- added current-week vs previous-week comparisons for calories, protein and known fiber
- added an overall weekly verdict and primary coaching focus
- weekly reviews now persist trend confidence, plan decision, goal/maintenance context and descriptive associations
- all nutrition calculations continue to use every day with logged intake; day status remains coverage metadata only

### Trend confidence

- added `private.get_trend_confidence(...)`
- classifies weight evidence as Building baseline, Emerging, Established, Noisy or Possible plateau
- compares regression evidence across multiple windows rather than treating a few flat scale days as a plateau
- reports intake estimate uncertainty alongside weight confidence

### Adaptive Coaching 2.0

- added `private.get_adaptive_plan_decision(...)`
- requires at least 14 logged intake days and four weigh-ins spanning 14 days before recommending a calorie change
- distinguishes Keep target, Observe another week, Consider increase/decrease, Need more data and maintenance-transition states
- material intake uncertainty can block a small apparent calorie adjustment
- calorie-change proposals remain conservative and require explicit approval; targets never change silently

### Goal and maintenance intelligence

- added confidence-aware goal forecasting using observed trend when sufficiently supported and planned pace otherwise
- maintenance-transition guidance takes priority as the goal is approached
- avoids recommending progressively lower calories merely because the user is near goal

### Pattern analysis

- weekly intelligence can surface descriptive associations such as weekday/weekend intake differences, exact-vs-estimated logging patterns and protein-food patterns when enough observations exist
- associations are explicitly non-causal

### Dashboard

- added a read-only Weekly Intelligence / Adaptive Coaching 2.0 section to Insights
- shows trend confidence, week-over-week changes, goal forecast, plan decision and estimate-uncertainty warnings
- Today remains status/guidance only and Quick Capture remains blocked

## V6.4 — Reliability, Reconciliation & Data Integrity — 2026-09-14

Hardens the invisible ChatGPT → Supabase → dashboard pipeline without adding any dashboard logging UI.

### Exactly-once writes

- all core meal, correction, deletion, weight and day-status writes require a non-empty request ID
- retries reuse the same request ID and return the already-applied action rather than creating another record
- added `private.get_action_status(...)` for uncertain network/tool outcomes
- canonical saved-food IDs are validated before a meal write can persist

### Duplicate protection and verification

- added `private.preflight_meal_write(...)` to detect an already-applied request or flag a suspicious recent lookalike
- possible duplicate meals remain advisory because legitimate repeated foods are allowed
- core writes now perform post-write verification inside the transaction
- failed verification raises and rolls the whole write back
- added `private.verify_ai_action(...)` for independent verification

### Corrections and audit

- added `private.find_recent_meals_for_correction(...)` so natural-language corrections can resolve the intended existing meal instead of adding a new one
- retained optimistic concurrency through `updated_at`
- added `private.get_audit_trail(...)` over request IDs, actions, before/after state and timestamps

### Integrity and reconciliation

- added `private.get_integrity_report(...)`
- checks meal totals vs item totals, action/entity links, saved-food references and advisory duplicate groups
- added `private.reconcile_integrity(...)` with dry-run support
- automatic reconciliation only repairs deterministic meal/item total mismatches; it never auto-deletes suspected duplicates
- current 30-day integrity scan: zero deterministic mismatches, zero broken action links, zero broken saved-food references

### Dashboard freshness

- foreground/resume/reconnect now silently reconciles against canonical Supabase state when the cached snapshot is stale
- Realtime subscriptions rebuild after reconnect
- all versioned dashboard JS/CSS assets are network-first in the service worker
- Quick Capture remains explicitly blocked from Today

## V6.3 — Food Intelligence & Memory 2.0 — 2026-09-14

- learned usual portions automatically from normal ChatGPT logging
- improved food-memory matching across names, aliases, brands, recency and frequency
- added verified-barcode memory, favorites and alias learning
- added passive repeated meal-pattern and pairing recognition
- integrated learned portions into V6.2 contextual food suggestions
- kept the dashboard read-only

## V6.2 — Smart Diet Coach & Decision Engine — 2026-09-14

- added passive Today guidance based on calories, protein, fiber, time, goal phase and uncertainty
- added contextual ranking of remembered foods
- added food-option comparison and “can I eat this?” backend helpers
- made coaching confidence-aware so large photo-estimate ranges do not trigger false precision
- preserved direct ChatGPT conversation as the only logging entry point

## V5.2 — Metrics & Stats — 2026-09-12

Focused analytics redesign making Diet Copilot easier to understand without adding manual logging UI.

### Key Stats

- added 7D / 28D / 90D stat ranges
- added clear calorie average, target hit rate and typical target miss
- added protein average and target-hit rate
- added fiber average, target-hit rate and explicit coverage count
- added trend weight, observed weekly pace and raw range change
- added goal progress %, kg remaining and ETA
- added complete/logged-day data-quality metric
- added exact/reused vs estimated meal quality
- added combined adherence score with visible weighting
- added rough maintenance estimate only after enough complete intake + weight trend data
- older diagnostic Insights moved behind an expandable secondary section
- Today now shows progress from phase baseline toward goal weight

### Metrics integrity

- incomplete/open days remain excluded from adherence averages
- missing fiber remains unknown, not zero
- weight pace requires adequate weigh-in count and time span
- early datasets explicitly show “Building baseline”
- added `private.get_metrics_snapshot(...)` so ChatGPT and the dashboard can share definitions

## V5.1 — Smart Diet Coach — 2026-09-12

- added portion-aware remembered-food logging with multipliers / changed gram amounts
- added observed pace vs planned pace classification
- added plateau / slower / faster / on-pace detection
- added goal ETA using observed trend when trustworthy, planned pace otherwise
- added adherence scoring across calories, protein and fiber
- added maintenance-transition guidance near goal weight
- added end-of-day closeout guidance
- weekly reviews now include coach interpretation

## V5 — Diet Intelligence — 2026-09-12

Expanded Diet Copilot from a read-only calorie dashboard into a ChatGPT-controlled diet intelligence system while preserving the no-manual-logging product rule.

### Completion and analytics integrity

- added explicit Complete / Open / Partial day workflow
- completed days are the only days used for intake averages
- later meals, corrections or deletions automatically reopen completed days
- day state is timezone-aware for the owner rather than depending on UTC midnight

### Food and meal memory

- exact nutrition-label/weighed foods are remembered automatically
- added alias-aware food-memory search and direct repeat logging
- added reusable multi-item meal memory and promotion from meal history
- linked existing exact-label salad/yogurt records into memory

### Nutrition expansion

- added fiber as a first-class tracked metric
- added optional carbs/fat storage and display
- backfilled known label macros for existing exact-label meals
- added fiber Today card and Fiber Trends
- incomplete macro coverage is represented as partial, not silently zero-filled

### Goals and phases

- added goal weight and desired weekly weight-change fields
- added Cut / Maintain / Gain / Custom phases
- phases can carry calorie, protein and fiber targets

### Adaptive targets

- added weight-trend/intake-based calorie recommendations
- default requirement: 14 complete days + 4 weigh-ins spanning 7+ days
- regression-based weight trend
- target changes capped to ±250 kcal per adjustment and rounded to 25 kcal
- recommendations require explicit user approval before applying

### Reviews and reminders

- added persisted weekly review support
- added weigh-in, day-close and weekly-review reminder preferences
- actual ChatGPT notifications remain opt-in and are scheduled separately

### Meal photos

- added durable meal photo URL/alt metadata
- added optional dashboard thumbnails when a safe durable HTTP(S) image exists
- no manual upload UI was introduced

### Dashboard

- Today surfaces fiber, day completeness and optional goal/macros context
- Trends supports Weight / Calories / Protein / Fiber
- Insights includes goal phase, 7-day review, calibration status and food memory
- account view shows read-only diet settings managed through ChatGPT

### Realtime and security

- enabled Supabase Realtime publication for dashboard-visible tables
- retained owner-scoped RLS
- retained SELECT-only authenticated browser grants
- privileged writes remain private to the ChatGPT bridge
- database healthcheck schema version is 6

## V4 — Vibrant Light — 2026-09-12

Complete visual/UX redesign of the read-only Diet Copilot dashboard.

- P1 visual foundation
- P2 mobile core
- P3 History / Trends / Insights
- P4 desktop and responsive UX
- P5 interaction / account / accessibility polish
- P6 final audit and release hardening

## Read-only Dashboard Rebuild — 2026-09-11

- removed manual nutrition CRUD from the website
- established ChatGPT → Supabase → read-only dashboard architecture
- retained authenticated RLS-protected history, trends, offline snapshot and correction bridge
