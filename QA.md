# Diet Copilot 2.0 — P12 production release gates

Date: 2026-09-29. Release: Web 2.0.0. Phase: P12 Production Promotion & Safe Cutover.

This document defines the production cutover gates. Evidence is the current commit's GitHub Actions run and attached JSON/screenshots, not a version label.

## Required automated verification

| Gate | Coverage |
| --- | --- |
| Deployed bytes | Canonical root shell, production manifest/service worker, all V2 runtime modules, SDK/icons and V1 rollback dependencies match the release commit byte-for-byte |
| Chromium / Firefox / WebKit | Canonical root launches 2.0, primary routes render, account dialog works, Google authorize starts correctly, mobile navigation/food shortcuts stay one-row and no runtime errors occur |
| OAuth relay | The shared `web-v2` relay target returns callbacks to `/diet/`, not the former RC-only `/diet/v2/` URL |
| Compatibility alias | `/diet/v2/` remains a functional stable 2.0 alias without RC markers |
| Legacy rollback | `/diet/legacy-v1.html` still loads the preserved V1 bundle and is not the default route |
| Root PWA | Root worker owns `/diet/`, installs the P12 production cache and reloads Diet Copilot 2.0 offline |
| Pages deployment | The tested commit is the commit whose bytes are publicly served |

## Safety invariants

The canonical Supabase project remains unchanged. P12 is a frontend promotion; it does not reset or migrate nutrition records. Owner-scoped reads/writes, explicit write confirmation, deterministic nutrition calculations, offline cache ownership and the no-exercise-calorie-eat-back rule remain intact.

Root and compatibility service workers have separate cache families. The production worker ignores `/diet/v2/` requests, preventing cross-scope offline-shell substitution. OAuth result URLs and callback endpoints are never cached.

## Manual verification boundaries

Automated browsers do not impersonate the user's real Google account, Samsung Internet, Android WebView, Health Connect or Play Store installation state. Those remain provider/device acceptance checks. The browser gate does verify the canonical Supabase authorize destination and the relay destination without exchanging real credentials.

## Rollback

If P12 fails after deployment, use the preserved `/diet/legacy-v1.html` frontend immediately while reverting the production shell/service worker in a reviewed commit. Do not modify or reset the production database as part of frontend rollback.
