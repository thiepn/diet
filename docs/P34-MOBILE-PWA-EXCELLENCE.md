# P34 — Mobile/PWA Interaction Excellence

P34 makes Diet Copilot dependable as a phone-first web app without redesigning the visual system.

The phase stays on the product track: no database migration, no nutrition-engine change and no new autonomous behavior.

## Mobile interaction

P34 hardens the existing responsive shell around real phone constraints:

- 44 px minimum touch targets for primary compact controls;
- 16 px mobile form text to prevent unwanted iOS input zoom;
- safe-area-aware top and bottom chrome for notches and home indicators;
- full-width bottom-sheet treatment for dialogs on small screens;
- full-width progress range controls;
- horizontal snapping for meal and food shortcut strips;
- a single-column fallback below 380 px;
- explicit standalone-mode handling.

The existing desktop shell remains unchanged.

## Soft keyboard behavior

The shell tracks focused form controls on phone-sized layouts.

While an input, textarea or select is active:

- the fixed bottom navigation moves out of the way;
- the floating Copilot button moves out of the way;
- dialog height follows the actual Visual Viewport when the browser exposes it.

This avoids the common mobile failure where the browser keyboard covers the action the user is trying to complete.

## Install experience

P34 gives the existing PWA a user-facing install surface under **More → App & offline**.

It reports:

- installed/browser state;
- offline-shell readiness;
- current online/offline status.

Chromium-style `beforeinstallprompt` is captured and exposed through an explicit **Install app** action.

On iOS/iPadOS, the app explains the native Safari **Share → Add to Home Screen** path instead of pretending a programmatic install prompt exists.

## Update experience

The service worker continues to update without background writes to Diet data.

When an already-controlled app receives a new service-worker controller, P34 surfaces **Update ready** and lets the user reload at a convenient moment instead of silently forcing a page reload while food or strategy input may be in progress.

## Offline correction

Before P34, the root production service worker listed the entire `v2/` runtime in its precache but then skipped all `/v2/` requests in the fetch handler.

That meant a cold offline launch could load cached HTML while failing to serve the CSS and JavaScript that actually power production.

P34 removes that bypass. The root service worker now serves the production `v2/` core from its managed cache when the network is unavailable.

The nested `/v2/` compatibility route still has its own more-specific service-worker scope.

## Manifest hardening

Both manifests now include:

- language and app categories;
- Strategy as an app shortcut;
- `launch_handler.client_mode = navigate-existing` where supported;
- an explicit no-related-native-app preference.

## Performance

P34 keeps the existing raw core asset ceiling at **750,000 bytes**.

The non-authoritative `v2/index.html` compatibility markup and existing runtime sources are compacted to make room for the mobile/PWA behavior rather than raising the budget.

## Boundaries

P34 does not:

- redesign colors or visual identity;
- add decorative motion;
- modify nutrition calculations;
- change P31 strategy decisions;
- change P32 Copilot write permissions;
- create background nutrition writes;
- require a new backend.

## Next phase

**P35 — Visual Design, Motion & Delight**

P35 can now improve polish, animation, feedback, transitions and visual reward on top of a mobile interaction model that is functionally stable.
