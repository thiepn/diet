# Changelog

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

- Today now surfaces fiber, day completeness and optional goal/macros context
- Trends now supports Weight / Calories / Protein / Fiber
- Insights now includes goal phase, 7-day review, calibration status and food memory
- account view shows read-only diet settings managed through ChatGPT

### Realtime and security

- enabled Supabase Realtime publication for all dashboard-visible tables
- retained owner-scoped RLS
- retained SELECT-only authenticated browser grants
- privileged writes remain private to the ChatGPT bridge
- database healthcheck schema version is now 6

## V4 — Vibrant Light — 2026-09-12

Complete visual/UX redesign of the read-only Diet Copilot dashboard.

### P1 — Visual foundation

- replaced the dark green developer-dashboard theme with a vibrant light consumer-health identity
- introduced semantic colors for calories, protein, weight, success and estimates
- refreshed typography, spacing, iconography, cards, PWA metadata and app icon

### P2 — Mobile core

- rebuilt Today around a coral calorie hero, blue protein tile and violet weight tile
- redesigned meals as compact expandable cards
- added clearer signed-out, empty, loading and error states
- prevented unauthenticated local snapshots from rendering as active dashboard data

### P3 — History, Trends & Insights

- compact History with 3/7/14/30/90/all ranges
- Weight / Calories / Protein trend tabs
- 7D / 30D / 90D / 6M / All chart ranges
- concise factual Insights instead of generic coaching

### P4 — Desktop & responsive UX

- added a true desktop sidebar and 12-column Today layout
- added tablet-specific behavior
- increased History density and expanded desktop charts
- added desktop 7-day snapshot
- removed portrait-only PWA orientation

### P5 — Interaction & polish

- redesigned account/login UI
- added human-readable auth/network errors
- added offline/sync/error notices
- improved keyboard focus, skip navigation and reduced-motion support
- hardened long text and interactive states

### P6 — Final audit & hardening

- corrected semantic text contrast while preserving vibrant fills
- fixed weight-chart label overlap
- prevented all-time bar-chart overlap on long histories
- added mouse, touch and keyboard chart value inspection
- removed the hard-coded “Morning weigh-in” assumption
- hardened account-dialog initialization/focus behavior
- safely cached only the version-pinned Supabase SDK for cold offline restore
- re-verified browser SELECT-only grants and owner-scoped RLS
- re-verified current production totals against Supabase

## Read-only Dashboard Rebuild — 2026-09-11

- removed manual nutrition CRUD from the website
- established ChatGPT → Supabase → read-only dashboard architecture
- retained authenticated RLS-protected history, trends, offline snapshot and correction bridge
