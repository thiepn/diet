# Diet Copilot V6.7 — Web Release Candidate & Final Certification

V6.7 is the final web/PWA stabilization release. It adds no new nutrition-entry workflow.

## Product boundary

```text
User → ChatGPT → canonical Supabase backend → read-only dashboard
```

- direct ChatGPT conversation remains the logging entry point
- the dashboard remains read-only
- Quick Capture is absent from production
- activity remains supporting context and is not automatically eaten back
- planned/hypothetical food is not introduced

## Production cutover

The production HTML loads exactly one local JavaScript runtime and one local stylesheet:

- `diet-app.js?v=1.0-rc1`
- `diet.css?v=1.0-rc1`

GitHub Pages/Jekyll expands those templates from the certified source list during the site build. Historical source fragments remain in the repository for audit history, but obsolete compatibility layers are not loaded by the browser.

Retired from the production JavaScript bundle:

- `dashboard-v5-1.js`
- `dashboard-v6.js`
- `dashboard-v6-1.js`
- `dashboard-v6-1-2.js`

This removes the old Quick Capture implementation, old recipe logging controls, duplicate activity Realtime plumbing and obsolete Smart Coach UI from the production runtime while retaining the current V6.2–V6.6 intelligence helpers.

## Nutrition-policy regression contract

Automated fixtures assert that:

1. every day with logged food contributes to nutrition statistics regardless of Open / Partial / Complete status
2. missing fiber stays unknown rather than being converted to zero
3. known fiber contributes even when coverage is partial, with full coverage reported separately
4. two intentionally identical meals/snacks remain two real entries
5. estimated meals contribute normally; uncertainty affects confidence, not inclusion

## Coaching regression contract

Synthetic histories assert that:

- a few weigh-ins across a very short span stay in `need_more_data`
- an established trend close to the desired pace keeps the calorie target unchanged
- material intake uncertainty blocks small apparent target adjustments
- near-goal cuts prioritize maintenance-transition guidance over further restriction

## UX certification

V6.7 hardens:

- 320–360 px narrow-phone layouts
- visual-viewport constrained metric detail sheets
- long text wrapping and horizontal-overflow prevention
- reduced-motion behavior
- landscape detail-sheet height
- persistent History/Trends interactions inherited from V6.6

The runtime exposes `window.DietRelease.certify()` for compact diagnostics covering product-boundary and layout invariants.

## PWA contract

Service worker generation: `diet-copilot-web-v1-rc1`.

Only the consolidated production bundles, shell metadata and icons are precached. Navigation and production bundle requests remain network-first with cache fallback. Old Diet Copilot cache generations are removed on activation.

## CI certification

The V6.7 CI pipeline validates:

- JavaScript syntax
- canonical backend and product-boundary rules
- nutrition/coaching regression fixtures
- exact bundle include order
- absence of obsolete dashboard logging UI in the expanded production bundle
- deterministic template expansion
- JavaScript/CSS size budgets
- an actual `actions/jekyll-build-pages` build
- syntax and Liquid-expansion of the generated `_site/diet-app.js`
- final `_site/index.html` references to the consolidated assets

A7 Operations and A8 Account Consumer contract workflows remain required and must pass before release.

## Release threshold

V6.7 can be merged to production only when CI, A7 Operations, A8 Account Consumer, the GitHub Pages build, and the canonical Supabase security/integrity checks have no new Diet-specific release blocker.
