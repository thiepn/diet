# Diet Copilot

Diet Copilot is a personal nutrition and weight-management app focused on fast logging, adaptive planning, trustworthy trends, and clear explanations.

Live app: **https://thiepn.dev/diet/**

## Product

The production application is the root `index.html` with the `v2/` runtime.

Core capabilities include:

- direct food logging;
- frequent and saved foods;
- saved meals and recipes;
- recent-meal repeat;
- quick add and meal editing;
- online food lookup;
- weight tracking and trend estimation;
- adaptive expenditure estimation;
- calorie and protein planning;
- training-aware nutrition;
- personal pattern intelligence;
- weekly strategy decisions;
- an in-app Diet Copilot;
- account sync, offline cache and PWA support.

Diet Copilot is designed around a simple loop:

**log → understand → learn → track → interpret → decide → explain → act**

## Intelligence model

Nutrition calculations are deterministic.

The adaptive engine is responsible for calculations such as:

- trend weight;
- intake reliability;
- expenditure estimates;
- confidence;
- target recommendations;
- training-day distribution;
- personal patterns.

The language model is used to explain those results and help prepare user-confirmed actions. It is not allowed to silently invent nutrition values or replace deterministic calculations.

## Architecture

### Active runtime

- `index.html`
- `v2/`

The `v2/` runtime is the authoritative product architecture.

### Legacy runtime

- `src/`

The historical `src/` dashboard is retained only as source for the certified V1 rollback bundle. It is not loaded by the production entrypoint and receives no new product features.

## Production foundation

The existing P1–P25 hardening remains in place where it supports the product:

- authentication and session persistence;
- owner isolation and RLS;
- canonical writes;
- encrypted off-site backups;
- recovery snapshots;
- integrity checks;
- idempotency and multi-device safety;
- privacy/export/account lifecycle;
- schema drift detection;
- monitoring and maintenance;
- hosted database upgrade validation.

This foundation is considered mature. Infrastructure work is now **product-driven maintenance**, not the primary development track.

## Development direction

P26 re-established the product-first roadmap after removing the governance detour.

Completed product phases:

- **P27 — Production Runtime Consolidation & Legacy Retirement**
- **P28 — Frictionless Food Capture**
- **P29 — Food Memory & Reuse Intelligence**
- **P30 — Onboarding, Goals & Phase Setup**
- **P31 — Adaptive Strategy & Weekly Review**
- **P32 — Copilot Actionability**
- **P33 — Progress, Trends & Visual Analytics**
- **P34 — Mobile/PWA Interaction Excellence**
- **P35 — Visual Design, Motion & Delight**
- **P36 — THIEPN Account & Ecosystem Fit**

Next phases:

1. **P37 — Real-World Usage Hardening**
2. **P38 — Product Release Candidate**

See `docs/P26-PRODUCT-REALITY-AUDIT.md` for the product rebaseline and the phase documents under `docs/` for implemented work.

## Scope boundary

Diet Copilot should validate:

- Diet-owned data and RPCs;
- Diet-owned Edge Functions;
- Diet UI/runtime;
- shared account contracts that Diet directly consumes.

Unrelated migrations from other apps in the shared Supabase project do **not** restart Diet Copilot's release lifecycle unless they change a consumed contract or produce a verified Diet regression.
