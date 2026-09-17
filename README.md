# Diet Copilot

**Web 1.0.3 · V6.8.2 · account lifecycle release**

Diet Copilot is a personal nutrition log and diet-intelligence system controlled through ChatGPT. The web application is a read-only dashboard: **You → ChatGPT → the canonical Supabase backend → Today, History, Trends and Insights.**

Production: https://thiepn.dev/diet/

## Fixed product scope

Meals, corrections, weigh-ins, reusable foods and target changes are logged through ChatGPT. The dashboard deliberately has no manual food-entry form or Quick Capture. Every logged intake day counts, whether its status is Open, Partial or Complete. Missing fiber remains unknown; known fiber still contributes, with incomplete coverage distinguished. Estimates count normally. Activity calories are not automatically eaten back, and recommendations never silently change targets.

## Account behavior

Google sign-in is the only account entry point. A single Supabase client owns session restoration, PKCE callbacks, token refresh and explicit local sign-out. The persistent storage adapter is installed before that client starts, not in a later compatibility patch. It verifies writes to localStorage and uses persistent first-party cookies when localStorage cannot retain the session. Long-lived sessions are never silently kept only in sessionStorage.

Nutrition snapshots are tagged with their account owner. Switching account or signing out clears visible private data and cancels/fences pending reads. Network outages do not become sign-outs. Storage errors, a revoked session and a temporary connection failure have distinct recovery states.

The Account dialog includes **Connection details** and **Copy diagnostics**. Diagnostics contain release, lifecycle and storage metadata, not credentials, tokens or nutrition records. Browser policies that delete all site data, private browsing, deliberate sign-out and server-side revocation can still require another login. The app does not attempt to bypass browser privacy settings.

The shared identity authority remains `sb-hycegznamzjhwinegaai-auth-token`. Cookies are first-party, Secure on HTTPS and SameSite=Lax; they are JavaScript-readable client storage, not HttpOnly server sessions. PKCE recovery is temporary and expires after 15 minutes.

## Backend and native boundary

The existing shared Supabase project `hycegznamzjhwinegaai` remains canonical. The retired Diet project `mrrqsqawwxwebsdmrnre` receives no active application reads or writes. This release changes no production nutrition records, auth accounts, database policies or infrastructure.

The existing Android companion integration and `dev.thiepn.diet://auth-callback/` handoff are retained. This web release is not a claim that a newly signed APK, Google Play submission, physical Android device or Health Connect permission flow has been certified.

## Dashboard

**Today:** calories, protein, fiber, weight, goal progress, meals and contextual guidance. **History:** date ranges, expandable meals, source quality and All/Exact/Estimated filters that never change totals. **Trends:** weight and nutrition metrics with explicit evidence maturity. **Insights:** weekly overview, nutrition, weight/goal, food memory, data quality and metric provenance.

## Build and test

Active source is under `src/`; retired code is under `archive/` and never enters the build. `scripts/build-v68.mjs` concatenates the explicit source list into committed `diet-app.js` and `diet.css`. GitHub Pages serves these unchanged; they are **not Jekyll templates**. `src/bootstrap.js` is last so the complete account implementation exists before startup.

The exact existing Supabase SDK is pinned locally in `vendor/supabase-2.116.0.js`, with its MIT license. The service-worker generation is `diet-copilot-web-v1.0.3-account1`. Auth callback URLs and backend responses are excluded from its caches.

```bash
node scripts/build-v68.mjs --write
node tests/account-storage.mjs
node tests/policy.mjs
node tests/release.mjs
node scripts/build-v68.mjs
```

Browser regression gates build the actual Pages `_site` and execute:

```bash
pip install playwright==1.57.0
python -m playwright install --with-deps chromium firefox webkit
python tests/account-browser.py --browser chromium --root _site --out account-results/chromium
python tests/account-browser.py --browser firefox --root _site --out account-results/firefox
python tests/account-browser.py --browser webkit --root _site --out account-results/webkit
python tests/account-offline.py --root _site --out account-results/offline
```

The browser suite uses real engines and the production SDK with mocked identity/API traffic. It closes tabs and restarts disk-backed browser profiles; it does not prove persistence by copying storageState. The separate offline suite runs a real service worker against a local HTTP server. No production credentials or private records are required.

See [QA.md](QA.md) for gates and [the account audit](docs/account-platform/ACCOUNT-RELEASE-1.0.3.md) for findings and verification boundaries. Release readiness requires the current commit's checks to pass, not a historical certification label.
