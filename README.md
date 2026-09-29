# Diet Copilot

**Web 2.0.0 · P12 production promotion**

Diet Copilot 2.0 is the production nutrition tracker and adaptive coaching experience at **https://thiepn.dev/diet/**. The former V1 frontend is preserved only as an emergency compatibility fallback at **/diet/legacy-v1.html**.

## Product scope

Diet Copilot 2.0 combines fast food logging, reusable foods and meals, weight/progress history, adaptive calorie targets, training-day distribution, activity context, strategy actions, exports, and an AI Copilot explanation layer. Deterministic nutrition calculations remain authoritative. Activity is context only and is not automatically eaten back.

Writes are owner-scoped and explicit. Food logging, corrections, reusable-food changes and strategy actions require deliberate user actions; the application does not silently change targets or nutrition records.

## Account and data safety

Google sign-in is the account entry point. The shared Supabase project `hycegznamzjhwinegaai` remains canonical. The 2.0 client owns PKCE exchange, token refresh and persistent session restoration through `sb-hycegznamzjhwinegaai-auth-token`.

Private cached nutrition snapshots are owner-scoped. Account switching and sign-out clear visible private state and fence pending reads. Network failures do not become sign-outs. Definitive authentication failures, stale/offline data and transient backend failures remain separate states.

The OAuth relay at `/wordstrike/` returns Diet 2.0 web callbacks to the canonical production URL `/diet/`.

## Production and rollback layout

- `/diet/` — canonical Diet Copilot 2.0 production surface.
- `/diet/v2/` — stable compatibility alias using the same 2.0 modules.
- `/diet/legacy-v1.html` — preserved V1 emergency fallback.
- `/diet/sw.js` — production 2.0 service worker and offline shell.
- `/diet/v2/sw.js` — narrower compatibility-route worker.

The production worker deliberately does not intercept `/diet/v2/`, so the narrower V2 worker can own that route. Legacy V1 caches are removed during P12 worker activation, while the V1 HTML/bundles remain available for rollback.

## P12 verification

The P12 gate verifies deployed bytes, canonical routing, Google OAuth relay behavior, account UI, mobile layout, V2 compatibility routing, legacy fallback availability, root service-worker scope and offline reload across Chromium, Firefox and WebKit.

```bash
python tests/p12-deployed-production.py
pip install playwright==1.57.0
python -m playwright install --with-deps chromium firefox webkit
python tests/p12-live-production.py --browser chromium --out p12-live/chromium
python tests/p12-live-production.py --browser firefox --out p12-live/firefox
python tests/p12-live-production.py --browser webkit --out p12-live/webkit
```

Earlier V1 release gates remain historical evidence for the preserved fallback. P12 certification is the release authority for the 2.0 production surface.
