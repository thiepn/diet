# Changelog

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
