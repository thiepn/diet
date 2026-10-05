# P27 — Production Runtime Consolidation & Legacy Retirement

P27 makes the runtime boundary explicit and enforceable without deleting the certified rollback path.

## Active production runtime

Diet Copilot production is:

- `index.html`
- `v2/`
- `sw.js`

All new product development belongs in `v2/`.

## Legacy rollback runtime

The historical V1 dashboard is retained only for rollback:

- `legacy-v1.html`
- `legacy-v1-app.js`
- `src/` as rollback-build source
- `diet.css` as rollback stylesheet

The legacy source is not loaded by the root production entrypoint.

## Why the legacy source remains

Deleting the V1 source would remove reproducibility of the existing rollback bundle without creating any user benefit.

P27 therefore retires it from **product development**, not from repository history or emergency rollback capability.

## Enforced rules

1. Root production may not import or load `src/`.
2. Root production may not load `legacy-v1-app.js`.
3. The rollback entrypoint must continue to load its rollback bundle.
4. New features may not be added to `src/`.
5. The V6.8 builder is rollback-only.
6. `v2/` is the sole active product source tree.

These rules are checked by `tests/p27-runtime-boundary-contract.mjs` in normal CI.

## Result

The repository now has one unambiguous active product architecture while preserving a known-good rollback path.

## Next phase

**P28 — Frictionless Food Capture**

P28 should optimize the highest-frequency user journey: finding, portioning, repeating, adding, correcting and undoing food with minimal interaction cost.
