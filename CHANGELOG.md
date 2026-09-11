# Changelog

## V1.0 — 2026-09-11

First stable Diet Copilot client release.

### Stabilized

- switched client persistence to version-independent storage keys
- migrates V0.1–V0.5 local state and legacy cloud configuration
- added first-run calorie/protein target confirmation
- added pre-destructive safety snapshots and recovery flow
- moved release/debug tooling under collapsed Advanced settings
- disposed old Supabase auth listeners/clients when reconfigured
- prevented zero-item/blank meals and saved meals
- preserved aggregate confidence for reusable estimated meals
- corrected weight-trend comparison to require complete seven-entry windows
- fixed bulk cloud-upload protein serialization
- improved clipboard/export compatibility and accessibility semantics
- improved mobile spacing around the sticky Add Meal control
- surfaced cloud errors/conflicts more clearly

### Retained

- database schema version 5; no V0.5 → V1.0 SQL migration required
- calorie/protein/weight tracking
- saved foods and reusable meals
- local-first offline operation
- Supabase sync + conflict protection
- AI RPC/audit/undo contract
- PWA support

### Verification

- static release validator
- browser-DOM fresh-install regression
- V0.5 storage migration regression
- saved-meal uncertainty regression
- weight-trend regression
- backup/reset regression

Real Supabase multi-device and physical-device checks remain listed in `QA.md`.
