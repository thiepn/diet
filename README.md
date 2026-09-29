# Diet Copilot

**Web 2.0.1 · P13 production monitoring and reliability**

Diet Copilot 2.0 is the production nutrition tracker and adaptive coaching experience at **https://thiepn.dev/diet/**. P13 keeps the P12 cutover architecture and adds privacy-safe operational monitoring without changing nutrition behavior.

## P13 reliability layer

Diet Copilot now has:

- a bounded **local-only operational telemetry** ring buffer;
- a **System Health** panel with data, Realtime, PWA and write-safety state;
- foreground/pageshow stale-data revalidation;
- write success/retry/failure/uncertain-state telemetry without payloads or request IDs;
- Realtime lifecycle diagnostics;
- PWA registration/update diagnostics;
- an **hourly external synthetic monitor** for the public production shell and Supabase Auth health;
- three-engine release certification after production deployments.

The telemetry policy deliberately excludes nutrition records, meal names, weight values, account email, tokens, OAuth codes, request IDs, Copilot messages and free-form user text. No third-party analytics SDK is used.

## Product scope

Diet Copilot combines fast food logging, reusable foods and meals, weight/progress history, adaptive calorie targets, training-day distribution, activity context, strategy actions, exports, and an AI Copilot explanation layer. Deterministic nutrition calculations remain authoritative. Activity is context only and is not automatically eaten back.

Writes are owner-scoped and explicit. Food logging, corrections, reusable-food changes and strategy actions require deliberate user actions; the application does not silently change targets or nutrition records.

## Account and data safety

Google sign-in is the account entry point. The shared Supabase project `hycegznamzjhwinegaai` remains canonical. Private cached nutrition snapshots are owner-scoped. Account switching and sign-out clear visible private state and fence pending reads. Network failures do not become sign-outs.

The shared OAuth relay returns Diet 2.0 callbacks to canonical `/diet/`. The independently frozen V1 rollback bundle retains its dedicated legacy callback route.

## Production and rollback layout

- `/diet/` — canonical Diet Copilot 2.0 production surface.
- `/diet/v2/` — stable compatibility alias.
- `/diet/legacy-v1.html` — independently sign-in-capable V1 emergency fallback.
- `/diet/sw.js` — P13 production service worker.
- `/diet/v2/sw.js` — narrower compatibility-route worker.
- `/diet/v2/telemetry.mjs` — local-only operational telemetry module.

## Verification

```bash
node tests/p13-telemetry.mjs
python -m py_compile tests/p13-synthetic-monitor.py tests/p13-live-reliability.py
python tests/p13-synthetic-monitor.py
```

GitHub Actions runs CI and account/operations contracts on pushes, release browser certification after Pages deployment, and the lightweight synthetic health monitor once per hour.

See [P13 operations](docs/P13-OPERATIONS.md) and [QA.md](QA.md).
