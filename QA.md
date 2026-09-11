# Diet Copilot V1.0 — QA Matrix

This matrix separates automated checks from scenarios that require a real Supabase project or physical devices.

## A. Static release checks

- [x] all `app-v1-*.js` files parse with `node --check`
- [x] `sw.js` parses with `node --check`
- [x] `manifest.webmanifest` parses as JSON
- [x] HTML parses without duplicate static IDs
- [x] V1.0 version markers are consistent
- [x] stable storage key + V0.5 migration path exist
- [x] no Supabase secret/service-role credential is embedded
- [x] browser SDK is pinned
- [x] service-worker core assets include all V1 runtime files
- [x] `python tools/validate_release.py` passes

## B. Automated browser-DOM regression

- [x] fresh app opens without runtime errors
- [x] first-run target banner appears
- [x] saving targets confirms/removes the banner
- [x] blank meal cannot be saved
- [x] normal item-level meal can be saved
- [x] V0.5 local data migrates to stable V1 storage
- [x] legacy cloud config migrates to stable cloud-config key
- [x] migration backup is created
- [x] saved meal preserves medium/low-confidence estimate metadata
- [x] weight trend compares complete seven-entry windows
- [x] local reset creates a safety backup
- [x] local reset deactivates cloud sync
- [x] local health check passes
- [x] bulk cloud-upload protein serialization uses `Number(...)`

## C. Manual local/browser checks

- [ ] meal edit/delete/undo through visible UI
- [ ] saved food create/edit/delete
- [ ] saved meal create/edit/delete
- [ ] Usual / Yesterday / Recent quick logging
- [ ] weight edit/remove flow
- [ ] Complete / Partial / Open status controls
- [ ] JSON export/import round trip
- [ ] History search
- [ ] History progressive loading with >30 days
- [ ] restore safety backup
- [ ] restore migration backup when available
- [ ] keyboard-only navigation
- [ ] reduced-motion preference
- [ ] narrow mobile viewport

## D. Fresh Supabase project

- [ ] install the schema from `supabase/schema.sql.gz`
- [ ] Security Advisor has no high-severity access-control finding
- [ ] create account/sign in works
- [ ] Advanced → Health check reports schema version 5
- [ ] Replace cloud ← this device works
- [ ] second client Replace device ← cloud works
- [ ] sign out and sign back in restores the correct account dataset

## E. V0.4 database migration

- [ ] run `supabase/upgrade-v0.4-to-v0.5.sql`
- [ ] V1.0 health check reports schema version 5
- [ ] existing cloud totals remain unchanged
- [ ] saved foods/meals remain intact
- [ ] normal create/edit/delete continues working

## F. Multi-device conflicts

1. Sync Device A and Device B.
2. Take A offline.
3. Edit the same synced meal on B and sync.
4. Edit the stale copy on A.
5. Reconnect A.

Expected: A reports a conflict and does not silently overwrite B.

- [ ] **Keep local edits** intentionally makes A win on edited rows
- [ ] **Use cloud** discards pending local edits and reloads cloud
- [ ] unrelated remote rows refresh after conflict resolution

## G. Offline queue lifecycle

- [ ] create meal offline → reconnect → appears in cloud
- [ ] create meal offline → delete before reconnect → no orphan/FK failure
- [ ] saved food + dependent meal sync parent-before-child
- [ ] failed network write backs off
- [ ] manual retry succeeds after issue is fixed

## H. Account/project isolation

- [ ] pending edits + sign out gives a safe warning/flow
- [ ] sign out disables active sync
- [ ] another account cannot receive previous account's queued edits
- [ ] changing Supabase project clears old baselines
- [ ] JSON import deactivates cloud sync until explicit direction is chosen

## I. ChatGPT RPC contract

Using a normal authenticated user JWT/RLS context:

- [ ] `diet_copilot_healthcheck`
- [ ] `get_diet_context`
- [ ] `search_diet_history`
- [ ] `log_meal_from_ai` idempotency
- [ ] `update_meal_from_ai` stale-write protection
- [ ] `delete_meal_from_ai` stale-write protection
- [ ] `log_weight_from_ai` idempotency
- [ ] `undo_ai_action`
- [ ] AI activity appears in Advanced diagnostics

## J. Platforms / PWA

- [ ] Android Chrome
- [ ] Android installed PWA
- [ ] desktop Chromium over real HTTP(S)
- [ ] desktop Firefox over real HTTP(S)
- [ ] service-worker update from V0.5 cache to V1.0 cache
- [ ] offline reload after initial installation
- [ ] GitHub Pages route `https://thiepn.github.io/diet/`

## Verification boundary

The V1.0 local/browser regression suite is complete. Sections D–J cannot be honestly marked passed until the app is connected to a dedicated Diet Copilot Supabase project and exercised on real clients/devices.
