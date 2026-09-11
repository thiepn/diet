# Diet Copilot V4 — Final QA

## Source / release wiring

- [x] P1–P6 assets are wired in deterministic load order
- [x] V4 is light-mode only
- [x] no manual meal/weight CRUD controls were reintroduced
- [x] service worker is same-origin only except for the exact version-pinned Supabase SDK
- [x] Supabase REST/Auth/Realtime responses remain excluded from service-worker caching
- [x] service-worker cache generation is `diet-copilot-dashboard-v4.0-p6.1`
- [x] PWA orientation supports portrait and landscape
- [x] mobile, tablet and desktop layout breakpoints are present

## UI / UX hardening

- [x] Today hierarchy: calories → protein → weight → meals
- [x] expandable meal detail cards
- [x] compact History layout
- [x] separate Weight / Calories / Protein trend views
- [x] factual Insights view
- [x] desktop fixed sidebar
- [x] desktop 7-day snapshot
- [x] signed-out / loading / empty / error states
- [x] offline / syncing / error notices
- [x] account/login UX hides Supabase infrastructure details
- [x] long meal names wrap safely
- [x] chart labels no longer overlap
- [x] long all-time chart bars shrink instead of overlapping
- [x] chart values are inspectable by mouse, touch and keyboard
- [x] current-day weight copy no longer assumes every weigh-in happened in the morning

## Accessibility

- [x] skip-to-content link
- [x] keyboard focus styles
- [x] reduced-motion handling
- [x] account form labels and inline validation
- [x] accessible password visibility control
- [x] live status/error regions
- [x] chart points/bars expose accessible labels
- [x] semantic text colors hardened for contrast while keeping vibrant fill colors

## Production data verification — 2026-09-12 audit

Verified directly against the Diet Copilot Supabase project:

- [x] 1 profile
- [x] 1 daily log
- [x] 2 meals
- [x] 1 weight entry
- [x] recorded day total: **1,259 kcal**
- [x] recorded protein total: **61.2 g**
- [x] calorie target: **2,300 kcal**
- [x] protein target: **160 g**
- [x] expected remaining calories for that recorded day: **1,041 kcal**
- [x] recorded weight: **84.0 kg**

## Browser/database security verification

- [x] authenticated role has SELECT-only table grants on `profiles`, `daily_logs`, `meals`, `meal_items`, `weight_entries`
- [x] each dashboard table has owner-scoped authenticated SELECT RLS
- [x] no authenticated nutrition-table INSERT / UPDATE / DELETE grants
- [x] authenticated executable public routines are read-only/support routines; privileged write bridge remains outside normal browser access
- [x] Supabase security advisor has no database/RLS warning; only the known leaked-password-protection warning remains
- [x] performance advisor reports only informational unused-index notices on this very small/new dataset

## Live device/browser matrix

These remain useful release smoke tests on physical browsers because this repository has no connected automated browser runner in the current session:

- [ ] Android Chrome / installed PWA
- [ ] Samsung Internet
- [ ] desktop Chromium
- [ ] desktop Firefox
- [ ] tablet / landscape PWA
- [ ] first online load → refresh → offline reload

The source, database, security, responsive rules and release wiring have been audited; the unchecked items above are physical/runtime smoke checks rather than known defects.
