# Diet Copilot V0.5 — Release QA Matrix

## A. Static package

- [ ] `for f in app-*.js sw.js; do node --check "$f"; done`
- [ ] `manifest.webmanifest` parses as JSON
- [ ] HTML parses without duplicate static IDs
- [ ] no secret/service-role credentials in frontend files
- [ ] Supabase browser SDK is pinned
- [ ] every service-worker core asset exists
- [ ] `python tools/validate_release.py` passes

## B. Local install

- [ ] fresh browser opens Today view
- [ ] meal create/edit/delete/undo works
- [ ] saved food + saved meal works
- [ ] quick logging works
- [ ] weight logging works
- [ ] Complete/Partial/Open works
- [ ] JSON export/import round-trip works
- [ ] History search works
- [ ] History “show more” works with >30 days
- [ ] release check reports no local failures

## C. Older local-data migration

- [ ] older V0.4 local dataset exists
- [ ] opening V0.5 migrates automatically
- [ ] calories/protein totals are unchanged
- [ ] weights unchanged
- [ ] saved foods/meals unchanged
- [ ] pre-V0.5 rollback button appears
- [ ] rollback restores previous snapshot

## D. Fresh Supabase

- [ ] decompress and run `supabase/schema.sql.gz`
- [ ] Security Advisor has no high-severity RLS findings
- [ ] create account/sign in works
- [ ] release check reports Schema v5
- [ ] Replace cloud ← this device works
- [ ] second device Replace device ← cloud works

## E. V0.4 Supabase migration

- [ ] run `supabase/upgrade-v0.4-to-v0.5.sql`
- [ ] release check reports Schema v5
- [ ] existing cloud records remain unchanged
- [ ] weight records have `updated_at`
- [ ] normal create/edit/delete continues working

## F. Sync conflicts

1. Sync Device A and Device B.
2. Take A offline.
3. Edit a shared meal on B and sync.
4. Edit the old copy on A.
5. Reconnect A.

Expected: A reports **Conflict** and does not silently overwrite B.

- [ ] **Keep local edits** makes A win only on edited rows and reloads unrelated cloud changes
- [ ] **Discard local edits + use cloud** makes cloud win

## G. Offline queue lifecycle

- [ ] create meal offline → reconnect → appears in cloud
- [ ] create meal offline → delete before reconnect → no FK/sync failure
- [ ] create saved food + dependent meal offline → parents sync before children
- [ ] failed network write backs off
- [ ] Retry failed sync works after issue is fixed

## H. Account/project isolation

- [ ] pending edits + sign out prompts
- [ ] sign out disables cloud activation
- [ ] another account does not receive a previous account's queued edits
- [ ] changing Supabase URL clears old baselines
- [ ] importing backup disables cloud activation

## I. ChatGPT RPCs

- [ ] `get_diet_context`
- [ ] `search_diet_history`
- [ ] `log_meal_from_ai` idempotency
- [ ] `update_meal_from_ai` stale-write protection
- [ ] `delete_meal_from_ai` stale-write protection
- [ ] `log_weight_from_ai` idempotency
- [ ] `undo_ai_action`
- [ ] AI activity appears in Settings

## J. Platforms

- [ ] Android Chrome / installed PWA
- [ ] desktop Chromium
- [ ] desktop Firefox
- [ ] narrow mobile viewport
- [ ] keyboard-only navigation
- [ ] reduced-motion preference

## V1 gate

Do not label the build V1.0 until critical sections A–I pass and no data-loss bug remains.
