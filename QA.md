# Diet Copilot Web 1.0 — QA & Certification

Internal milestone: **V6.8.1**  
Stable release: **1.0.1**

## Product boundary

- [x] dashboard remains read-only
- [x] ChatGPT remains the logging/control layer
- [x] no Quick Capture surface
- [x] no manual meal, weight or target editor
- [x] no automatic activity-calorie eat-back
- [x] no silent calorie-target changes
- [x] authenticated browser sessions have no Diet write policy

## Nutrition-policy regressions

- [x] Open days with logged intake count
- [x] Partial days with logged intake count
- [x] Complete days count under the same rule
- [x] day status is coverage metadata only
- [x] missing fiber remains unknown rather than zero
- [x] known fiber values still contribute with full coverage reported separately
- [x] estimated meals count normally
- [x] uncertainty affects confidence, not inclusion
- [x] intentionally repeated identical meals remain separate records

## Coaching regressions

- [x] insufficient weight evidence remains Building baseline
- [x] established pace close to plan keeps the current target
- [x] material intake uncertainty can block a small calorie adjustment
- [x] short flat periods do not override a usable longer trend
- [x] near-goal phases prioritize maintenance transition
- [x] recommendations remain advisory until explicitly accepted

## Dashboard

### Today

- [x] calories
- [x] protein
- [x] fiber
- [x] weight
- [x] goal/progress
- [x] meals
- [x] passive contextual guidance
- [x] detail-sheet provenance
- [x] no activity card
- [x] no obsolete closeout prompt

### History

- [x] 3D / 7D / 14D / 30D / 90D / All
- [x] All / Exact / Estimated meal filters
- [x] filters do not alter full-day totals
- [x] uncertainty ranges remain visible where available
- [x] long content wraps without widening the app

### Trends

- [x] Weight / Calories / Protein / Fiber
- [x] 7D / 30D / 90D / 6M / All
- [x] selected range/metric persistence
- [x] evidence maturity/confidence state
- [x] small datasets do not present fake mature trends

### Insights

- [x] This week
- [x] Nutrition
- [x] Weight & goal
- [x] Food intelligence
- [x] Data quality
- [x] no duplicate legacy coach/review stacks in the final presentation

## Runtime architecture

- [x] one local production JavaScript bundle: `diet-app.js`
- [x] one local production stylesheet: `diet.css`
- [x] active source lives under `src/`
- [x] retired source/build/test layers live under `archive/`
- [x] archive content cannot feed the production builder
- [x] no root-level historical `dashboard-*.js/css` fragments
- [x] one final canonical dashboard refresh pipeline
- [x] one owner-scoped Diet Realtime channel
- [x] deterministic bundle expansion
- [x] actual GitHub Pages Jekyll output validated in CI

## Mobile/accessibility

- [x] horizontal-overflow guard
- [x] 320–360 px layout hardening
- [x] detail sheet constrained to visual viewport
- [x] safe bottom-sheet layout on phones
- [x] landscape detail-sheet handling
- [x] long text wrapping
- [x] visible focus states retained
- [x] dialog semantics retained
- [x] reduced-motion preference supported

## PWA

- [x] stable cache generation: `diet-copilot-web-v1.0.1`
- [x] old Diet Copilot caches removed on activation
- [x] navigation is network-first
- [x] consolidated JS/CSS are network-first
- [x] Supabase responses are never service-worker cached
- [x] cached read-only shell remains available for degraded use

## Backend certification — 2026-09-14

- [x] canonical project ref `hycegznamzjhwinegaai`
- [x] retired project is absent from active runtime config
- [x] Diet RLS enabled on 13/13 dashboard tables
- [x] authenticated Diet write policies: 0
- [x] meal/item total mismatches: 0
- [x] broken action links: 0
- [x] broken saved-food references: 0
- [x] deterministic integrity repairs required: 0
- [x] one advisory duplicate group reviewed and retained because both snack entries are intentional
- [x] no new Diet-specific Supabase security-advisor warning

## Release gates

- [x] JavaScript syntax
- [x] backend/product contract
- [x] nutrition/coaching regression suite
- [x] release bundle certification
- [x] deterministic bundle generation
- [x] A7 operations contract
- [x] A8 account consumer contract
- [x] actual GitHub Pages build validation
- [x] JS production budget < 400 KB
- [x] CSS production budget < 160 KB

## Authentication & Android release

- [x] Google-only account UI
- [x] no active email/password auth implementation
- [x] Supabase PKCE enabled
- [x] native OAuth callback returns through `dev.thiepn.diet://auth-callback/`
- [x] one-time PKCE code removed from browser history before app handoff
- [x] Android release version `7.0.2` / versionCode `702`
- [x] Android package is non-debuggable
- [x] Android backup disabled
- [x] cleartext traffic disabled
- [x] APK Signature Scheme v2/v3 verified

## Device smoke checks

These are physical-device checks, not known failures:

- [ ] installed Android PWA
- [ ] Samsung Internet
- [ ] desktop Chromium
- [ ] desktop Firefox
- [ ] tablet / landscape
- [ ] online → offline → online recovery on a real device
