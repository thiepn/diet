# Changelog

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

Major product correction aligning Diet Copilot with its original goal.

### Removed from the website

- manual meal creation/editing
- manual calorie/protein entry
- manual weight logging
- saved-food management
- saved-meal management
- one-tap food logging
- day-status editing
- nutrition CRUD controls
- manual target editing

### New product boundary

- ChatGPT is the logger/editor
- Supabase is the source of truth
- website is a read-only viewer

### Dashboard

- Today summary
- history ranges
- weight and calorie trend charts
- protein consistency
- logging completeness
- exact vs estimated data-quality breakdown
- Realtime refresh when ChatGPT/database changes arrive
- offline cached viewing

### Compatibility

- database remains schema v5
- existing ChatGPT RPC bridge is retained
- existing authenticated user data is retained
