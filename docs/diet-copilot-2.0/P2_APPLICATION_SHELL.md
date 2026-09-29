# Diet Copilot 2.0 — P2 Application Shell

Status: **implemented on `diet-copilot-2.0`**

P2 creates the new product shell while keeping Diet Copilot V1 fully intact on production `main`.

## Product structure

Diet Copilot 2.0 has exactly five primary destinations:

1. **Today**
2. **Food**
3. **Progress**
4. **Strategy**
5. **More**

The old V1 primary destinations `History`, `Trends` and `Insights` are deliberately removed from primary navigation. Their useful functions are redistributed:

- meal/history browsing -> **Food**
- weight/intake/TDEE charts -> **Progress**
- recommendations/goal intelligence -> **Strategy**
- secondary settings/tools -> **More**

This prevents the navigation from mirroring implementation history.

## Today

Purpose: answer three questions quickly.

1. What have I eaten today?
2. What remains?
3. Am I following the current plan?

P2 establishes slots for:

- calories,
- protein,
- trend weight,
- adaptive expenditure,
- today's meals,
- current strategy,
- one primary **Add food** action.

P2 does not fabricate data. Until a read adapter is connected, every unavailable metric is explicitly marked as disconnected.

## Food

Purpose: make food logging the fastest workflow in the product.

The shell establishes one unified entry surface for:

- search,
- recent foods,
- saved meals,
- barcode,
- natural-language meal description,
- today's meal timeline.

The screen intentionally avoids a secondary nested navigation bar.

## Progress

Purpose: show body-composition and nutrition signals without dashboard overload.

P2 reserves four primary analysis surfaces:

- trend weight,
- expenditure,
- intake vs target,
- goal trajectory.

The default range selector is compact and does not occupy a permanent toolbar.

## Strategy

Purpose: keep all goal/calorie-decision information together.

The shell reserves:

- goal mode,
- goal weight,
- target pace,
- estimated expenditure,
- current calorie target,
- confidence,
- recommendation rationale.

P1/P1.5 confidence is a first-class concept. A point estimate and permission to adjust calories are intentionally separate.

## More

Purpose: keep secondary functionality out of the daily loop.

Initial categories:

- Foods & meals
- Integrations
- Body measurements
- Account
- Appearance
- Data & export

Additional settings should be added here unless they are genuinely part of a daily task.

## Responsive shell

### Desktop

- fixed/sticky left navigation rail,
- compact sticky top bar,
- centered content region capped at 1180 px,
- no permanent right sidebar,
- multi-column cards only when width supports them.

### Mobile

- no desktop sidebar,
- compact one-row top bar,
- **one-row, five-column bottom navigation**,
- bottom navigation height: 64 px plus device safe area,
- labels are forced to one line,
- content receives bottom padding so the navigation never covers controls,
- cards collapse to one column except the compact metric grid.

The mobile navigation is a hard regression-tested requirement. Future features may not create a second or third toolbar row.

## Accessibility

P2 includes:

- skip-to-content link,
- semantic navigation landmarks,
- `aria-current` for the active route,
- programmatically focusable main content,
- live-region shell feedback,
- visible `:focus-visible` treatment,
- minimum practical touch targets,
- reduced-motion support,
- safe-area support,
- system light/dark mode.

## Navigation behavior

Routes use lightweight hash navigation:

```text
#today
#food
#progress
#strategy
#more
```

The last route is restored for the current browser session.

The `/` keyboard shortcut moves directly to the Food search surface.

A small `window.DietV2Shell` diagnostic API exposes:

- shell version,
- route list,
- current route,
- navigation helper,
- toast helper.

This is for development/certification only; it is not a backend authority.

## Styling system

P2 starts a clean 2.0 token layer rather than extending the accumulated V1 styles.

Core tokens include:

- background / surfaces,
- borders,
- primary / secondary text,
- single green accent family,
- focus color,
- radii,
- content width,
- top/bottom navigation dimensions.

No V1 CSS file is imported into `/v2/`.

## Safety boundary

P2 is intentionally frontend-only.

It performs:

- no Supabase calls,
- no API fetches,
- no writes,
- no auth mutations,
- no schema changes,
- no target adjustments.

The current account button and incomplete feature controls surface explicit preview messages rather than silently doing nothing or calling legacy mutations.

## Production isolation

P2 lives under:

`/v2/`

Files:

- `v2/index.html`
- `v2/shell.css`
- `v2/shell.js`

The root production `index.html`, `diet-app.js`, `diet.css`, manifest and stable build pipeline remain V1.

P2 files are included in the ordinary static GitHub Pages build artifact for branch/build validation, but P2 is not the production entry point.

## Regression tests

`tests/v2-shell.mjs` enforces:

- exactly five primary destinations,
- desktop + mobile nav copies only,
- removal of legacy primary routes,
- single-row five-column mobile nav,
- one-line mobile nav labels,
- safe-area bottom navigation,
- reduced motion,
- dark mode,
- focus visibility,
- horizontal overflow guard,
- explicit disconnected data states,
- no backend/network activity in the shell JavaScript.

CI additionally verifies that the Jekyll build emits all three `/v2/` assets.

## P2 completion rule

P2 is complete when:

- shell regression tests pass,
- existing V1 regression/build/release tests remain green,
- production `main` remains identical to the P0 freeze,
- the P2 route is isolated from production data writes.

The next phase should connect real read-only data to these surfaces before adding complex workflows.
