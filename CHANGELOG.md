# Changelog

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
- 3/7/14/30/90/all history ranges
- weight and calorie trend charts
- seven-entry moving weight average
- regression-based weekly weight pace
- protein consistency
- logging completeness
- exact vs estimated data-quality breakdown
- automatic Realtime refresh when ChatGPT/database changes arrive
- offline cached viewing

### Compatibility

- database remains schema v5
- existing ChatGPT RPC bridge is retained
- existing Supabase connection configuration is reused
- previous V1 local state migrates into a read-only snapshot
