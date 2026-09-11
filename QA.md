# Diet Copilot V5 — QA

## Product boundary

- [x] website remains read-only
- [x] no manual meal/weight/target editor introduced
- [x] ChatGPT remains the logging/control layer
- [x] browser grants remain SELECT-only
- [x] owner-scoped RLS covers all dashboard-visible tables

## V5 schema / feature checks

- [x] database healthcheck schema version is 6
- [x] profile supports fiber, goal pace, adaptive-target and reminder preferences
- [x] meals/items support carbs, fat and fiber
- [x] meal photo URL/alt metadata supported
- [x] food memory supports brand/barcode/aliases/macros/use count
- [x] reusable meal memory supported
- [x] goal phases supported
- [x] weekly reviews supported
- [x] adaptive target recommendations supported

## Day completeness

- [x] ChatGPT can set Open / Complete / Partial
- [x] only Complete days feed adherence averages
- [x] later meal automatically reopens a completed day
- [x] meal correction automatically reopens a completed day
- [x] meal deletion automatically reopens a completed day
- [x] local-day handling no longer depends solely on UTC midnight

## Repeat-food / meal memory

- [x] exact nutrition-label foods auto-save to memory
- [x] exact food aliases can be searched
- [x] `protein yogurt` matches the existing Milbona yogurt memory
- [x] saved food can be logged directly without re-estimation
- [x] historical meals can be promoted into reusable meal memory
- [x] saved meal can be logged directly
- [x] existing salad/yogurt exact-label items backfilled and linked to memory

## Macro behavior

- [x] calories and protein remain primary
- [x] fiber added as third first-class metric
- [x] carbs/fat are optional and hidden by default
- [x] missing macro fields remain unknown rather than zero-filled
- [x] fiber daily averages require complete fiber coverage
- [x] known existing label macros backfilled

## Goal / adaptive target behavior

- [x] goal weight can be stored
- [x] desired weekly loss/gain rate can be stored
- [x] Cut / Maintain / Gain / Custom phases supported
- [x] adaptive recommendation requires desired rate
- [x] default requires 14 complete days
- [x] requires >=4 weigh-ins spanning >=7 days
- [x] uses regression-based weight trend
- [x] maintenance estimate incorporates observed intake + weight trend
- [x] adjustment capped to ±250 kcal at a time
- [x] recommendation rounded to 25 kcal
- [x] recommendation does not auto-apply
- [x] explicit accept/dismiss functions exist

## Weekly review / reminders

- [x] weekly review generation works in rollback test
- [x] dashboard exposes live 7-day review summary
- [x] weigh-in/day-close/weekly-review reminder preferences stored
- [x] reminder timezone stored
- [x] actual notification automations remain opt-in and require a user-selected cadence/time

## Dashboard

- [x] V5 CSS/JS wired after V4 hardening layers
- [x] Today shows fiber without turning into a macro spreadsheet
- [x] current day displays Open / Complete / Partial status
- [x] optional goal strip only appears when configured
- [x] carbs/fat strip only appears when enabled
- [x] meal details show available macros
- [x] safe HTTP(S) photo thumbnail supported
- [x] Trends supports Weight / Calories / Protein / Fiber
- [x] Insights includes Goal / 7-day Review / Calibration / Food Memory
- [x] account sheet shows read-only diet settings
- [x] mobile/tablet/desktop responsive layers preserved

## Realtime / offline

- [x] V5 service-worker cache generation is `diet-copilot-dashboard-v5.0`
- [x] Supabase API/Auth/Realtime responses are not service-worker cached
- [x] exact pinned Supabase SDK may be cached for cold offline restore
- [x] `supabase_realtime` publication includes core + V5 dashboard-visible tables
- [x] frontend subscribes to core + V5 tables

## Regression tests performed

Rollback transaction verified calls to:

- [x] search food memory
- [x] direct saved-food logging
- [x] day complete
- [x] day reopen
- [x] profile preference update
- [x] start goal phase
- [x] generate weekly review
- [x] generate adaptive target recommendation

The rollback left no V5 test meals/phases/preferences/recommendations behind.

## Production data sanity

At V5 rollout:

- [x] existing meal/weight history preserved
- [x] 2026-09-11 remains 1,259 kcal / 61.2 g protein
- [x] 2026-09-12 yogurt remains 142 kcal / 20 g protein
- [x] calorie target remains 2,300 kcal
- [x] protein target remains 160 g
- [x] fiber target defaults to 30 g
- [x] no calorie target was silently recalibrated
- [x] goal weight / desired pace remain unset until user chooses them

## Physical browser smoke checks

A connected automated browser runner was not authenticated in this session. These remain useful real-device checks rather than known failures:

- [ ] Android Chrome / installed PWA
- [ ] Samsung Internet
- [ ] desktop Chromium
- [ ] desktop Firefox
- [ ] tablet / landscape PWA
- [ ] first online V5 load → refresh → offline reload
