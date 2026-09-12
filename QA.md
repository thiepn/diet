# Diet Copilot V5.2 — QA

## Product boundary

- [x] website remains read-only
- [x] no manual meal/weight/target editor introduced
- [x] ChatGPT remains the logging/control layer
- [x] browser grants remain SELECT-only
- [x] owner-scoped RLS covers dashboard-visible tables

## V5 core

- [x] Complete / Open / Partial day workflow
- [x] incomplete days excluded from adherence averages
- [x] exact food and reusable meal memory
- [x] calories / protein / fiber tracking
- [x] optional carbs/fat hidden by default
- [x] goal phases and goal weight
- [x] desired weekly pace
- [x] adaptive target recommendations require approval
- [x] weekly review support
- [x] reminder preferences
- [x] Realtime publication enabled

## V5.1 Smart Diet Coach

- [x] portion-scaled remembered-food logging
- [x] 0.5× / 1.5× / 2× nutrient scaling keeps unknown macros unknown
- [x] observed weekly pace requires >=4 weigh-ins spanning >=7 days
- [x] pace states include baseline / on pace / slower / faster / possible plateau
- [x] goal ETA uses observed pace when trustworthy
- [x] planned pace is fallback ETA before a reliable observed trend exists
- [x] adherence score uses Complete days only
- [x] maintenance transition remains advisory
- [x] Today closeout guidance added
- [x] rollback tests left no scaled-food test rows behind

## V5.2 Metrics & Stats

- [x] 7D / 28D / 90D Key Stats ranges
- [x] calorie average uses Complete days only
- [x] calorie hit = within ±150 kcal of recorded target
- [x] typical calorie miss uses mean absolute target deviation
- [x] protein average / target-hit rate use Complete days only
- [x] fiber average / hit rate only use days with complete fiber coverage
- [x] trend weight uses latest available weigh-ins rather than one scale reading
- [x] observed pace withheld until weight data is sufficient
- [x] goal progress uses phase baseline toward goal weight
- [x] goal ETA labels planned vs observed basis
- [x] data quality shows Complete/logged days
- [x] data quality shows exact/reused vs estimated meal proportion
- [x] adherence weighting is visible: 45% calories / 35% protein / 20% fiber when fiber coverage exists
- [x] estimated maintenance withheld until >=14 Complete days and usable weight pace
- [x] early data shows Building baseline rather than fake precision
- [x] legacy diagnostic Insights remain available under expandable secondary details
- [x] Today shows goal progress when configured
- [x] shared `private.get_metrics_snapshot(...)` matches dashboard definitions

## Current live-data sanity — 2026-09-12

- [x] goal weight = 75 kg
- [x] desired pace = -0.5 kg/week
- [x] current daily target = 2,000 kcal
- [x] current protein target = 130 g
- [x] fiber target = 30 g
- [x] current phase = Cut to 75 kg
- [x] 28-day metrics correctly report 0 Complete days rather than averaging open days
- [x] trend weight currently = 84.0 kg from available weigh-in data
- [x] goal progress currently = 0%
- [x] remaining to goal = 9.0 kg
- [x] planned ETA currently ≈18 weeks at -0.5 kg/week
- [x] 3 meals currently visible to metrics
- [x] 2 of 3 meals exact/reused → 67% exact rate

## Security / resilience

- [x] V5.2 migration introduced no new Supabase security-advisor warning
- [x] only remaining security advisor warning is account-level leaked-password protection disabled
- [x] Supabase REST/Auth/Realtime responses are not service-worker cached
- [x] exact version-pinned Supabase SDK may be cached for cold offline restore
- [x] V5.2 service-worker generation is `diet-copilot-dashboard-v5.2`

## Physical browser smoke checks

These remain real-device checks rather than known failures:

- [ ] Android Chrome / installed PWA
- [ ] Samsung Internet
- [ ] desktop Chromium
- [ ] desktop Firefox
- [ ] tablet / landscape PWA
- [ ] first online V5.2 load → refresh → offline reload
