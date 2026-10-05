# P26 — Product Reality Audit, Core User Journey & Development Rebaseline

P26 resets Diet Copilot development around the product people actually use.

## Production reality

The production application is the root `index.html` plus the `v2/` runtime.

Current production modules include:

- account/session and owner-scoped data loading;
- Today dashboard;
- direct food logging;
- saved foods and saved meals;
- recent-meal repeat;
- quick add;
- Open Food Facts lookup;
- meal editing and deletion;
- adaptive nutrition calculations;
- weight trend and expenditure estimation;
- training-aware nutrition planning;
- personal pattern intelligence;
- strategy actions;
- settings and profile management;
- in-app Diet Copilot;
- PWA/offline support.

The historical `src/` dashboard tree is no longer loaded by production `index.html`. It remains repository legacy and must not drive new product decisions.

## What P1–P25 already solved

The following infrastructure is mature enough for the product:

- production deployment;
- authentication and session persistence;
- owner isolation / RLS;
- canonical write paths;
- recovery snapshots and encrypted off-site backup;
- integrity constraints;
- idempotency / multi-device write safety;
- schema drift detection;
- privacy/export/account lifecycle;
- monitoring and maintenance;
- hosted database upgrade validation.

These controls stay. Future phases should modify them only when a product requirement or concrete defect demands it.

## What P26–P43 got wrong

The reverted phases optimized Diet Copilot for:

- fleet-wide governance;
- cross-app release trains;
- policy-as-code;
- compliance evidence ledgers;
- operating-effectiveness periods;
- repeated shared-platform burn-in generations;
- whole-project epoch freezing.

That coupled Diet Copilot's product lifecycle to unrelated StudyOS, Hub, Library and Gomoku migrations.

No production `src/` or `v2/` product files were improved by those phases.

They are therefore outside Diet Copilot's appropriate scope and have been removed from the current tree.

## Core product loop

Diet Copilot should optimize this loop:

1. **Capture** — log what was eaten with the fewest possible actions.
2. **Understand** — immediately see calories, protein, macros and uncertainty.
3. **Remember** — make repeated foods/meals faster every time.
4. **Track** — add weight/activity/training context without clutter.
5. **Interpret** — convert noisy day-to-day data into trends and confidence.
6. **Decide** — recommend whether the current plan should stay or change.
7. **Explain** — Copilot explains the recommendation and evidence in plain language.
8. **Act** — any target or plan change is explicit, reviewable and reversible.

Anything that does not improve this loop is secondary.

## Product strengths already present

### Food logging

The V2 app already supports:

- meal-type selection;
- frequent foods;
- saved foods;
- saved meals / recipes;
- recent-meal repetition;
- exact manual entry;
- undo after logging;
- food library management;
- online food lookup;
- barcode-oriented lookup;
- meal editing and deletion.

The foundation is strong. The next work should focus on speed, defaults, portions and error recovery rather than replacing it.

### Adaptive intelligence

The deterministic engine already provides:

- trend-weight estimation;
- intake completeness/reliability;
- expenditure estimation;
- confidence scoring;
- target recommendations;
- training-day distribution;
- personal pattern detection.

This is a major product advantage. It should become more visible and understandable in the UI.

### Copilot

The V2 Copilot is correctly bounded:

- deterministic calculations remain outside the language model;
- AI explains rather than silently recalculates;
- user confirmation is required before writes;
- only compact derived context is sent remotely.

Future Copilot work should make it more useful, not more autonomous.

## Current product problems

### P0 — architecture clarity

The repository still contains the old `src/` application alongside production `v2/`.

This creates false product signals, duplicate implementations and unnecessary maintenance risk.

**Required:** formally retire/archive the legacy runtime and make `v2/` the only active application architecture.

### P0 — logging friction

Logging is the highest-frequency action in the product.

Current capabilities are broad, but speed must be audited around:

- default meal type;
- usual portion;
- repeat-last / repeat-yesterday;
- quantity adjustment before logging;
- multi-item meal composition;
- keyboard-first desktop flow;
- one-thumb mobile flow;
- undo/edit recovery;
- unknown-food path;
- online lookup latency/failure.

A technically complete logger that takes too many taps will still fail as a daily-use product.

### P0 — onboarding

A new account needs an obvious path from zero data to a usable plan.

The onboarding flow should establish only what is required:

- weight;
- goal / goal phase;
- desired rate;
- initial calorie/protein settings when needed;
- training schedule;
- optional activity integration.

It should then explain what Diet Copilot will learn automatically over time.

### P1 — Today hierarchy

Today should answer, in order:

1. What have I eaten?
2. What is left?
3. Am I on plan?
4. What should I do next?

Secondary analytics should not compete with those four questions.

### P1 — weekly decision loop

The adaptive engine is substantially more sophisticated than the product surface communicates.

A weekly review should clearly show:

- observed weight trend;
- data confidence;
- intake adherence;
- estimated expenditure;
- current target;
- recommendation;
- why the recommendation was made;
- what evidence is missing;
- explicit apply / keep-current action.

### P1 — food memory

Saved-food intelligence should feel automatic:

- recent portions;
- usual portions;
- favorite/repeated foods;
- recurring combinations;
- meal templates;
- duplicate detection;
- improved search ordering.

The goal is for logging effort to fall as usage increases.

### P1 — progress visualisation

Progress should emphasize:

- smoothed weight trend;
- target trajectory;
- calorie adherence;
- protein adherence;
- expenditure trend;
- phase progress;
- confidence/data coverage.

Charts should support decisions rather than simply display available metrics.

### P2 — mobile interaction quality

Diet Copilot is a high-frequency mobile product.

Audit:

- bottom-navigation reachability;
- dialog/sheet behavior;
- keyboard avoidance;
- tap target size;
- sticky action placement;
- offline states;
- loading skeletons;
- accidental double writes;
- installability;
- perceived responsiveness.

### P2 — visual polish

The UI is functional and reasonably coherent, but the final product should feel intentional rather than administrative.

Improve:

- motion;
- state transitions;
- hierarchy;
- empty states;
- success feedback;
- progress animation;
- chart interaction;
- food-card visual density;
- Copilot presentation.

Motion remains optional and must respect reduced-motion settings.

## Scope rule from P26 onward

Diet Copilot owns:

- Diet tables and RPCs;
- Diet Edge Functions;
- Diet UI/runtime;
- compatibility with shared THIEPN Account contracts it actually consumes.

Diet Copilot does **not** own certification of every migration in the shared Supabase project.

An unrelated app migration is not a Diet release event unless it changes a contract Diet depends on or causes a verified Diet regression.

## Corrected roadmap

### P27 — Production Runtime Consolidation & Legacy Retirement
Make `v2/` the unambiguous single production architecture. Remove/archive obsolete runtime layers and stale version semantics without changing user data.

### P28 — Frictionless Food Capture
Optimize frequent foods, recent meals, portions, search, online lookup, keyboard/mobile capture and undo/edit paths.

### P29 — Food Memory & Reuse Intelligence
Make saved foods, portions, combinations and meal templates improve automatically from normal usage.

### P30 — Onboarding, Goals & Phase Setup
Create a short first-run flow that gets a new account to a valid nutrition plan without unnecessary configuration.

### P31 — Adaptive Strategy & Weekly Review
Turn the existing deterministic engine into a clear weekly decision workflow with confidence-aware recommendations.

### P32 — Copilot Actionability
Make Copilot explain daily status, strategy and patterns and prepare safe confirmed actions from existing deterministic outputs.

### P33 — Progress, Trends & Visual Analytics
Rebuild progress views around weight trend, adherence, expenditure, goal trajectory, phase status and data quality.

### P34 — Mobile/PWA Interaction Excellence
Polish one-thumb capture, dialogs/sheets, offline behavior, loading, keyboard handling and installability.

### P35 — Visual Design, Motion & Delight
Apply coherent motion, success feedback, hierarchy and interaction polish without harming accessibility.

### P36 — THIEPN Account & Ecosystem Fit
Keep account/sync integration seamless while limiting shared-platform coupling to explicit contracts.

### P37 — Real-World Usage Hardening
Use Diet Copilot as a daily tool, collect concrete friction/defects and fix only issues supported by actual use.

### P38 — Product Release Candidate
Accessibility, performance, browser/mobile compatibility, defect-only stabilization and final release packaging.

## Exit condition for P26

P26 is complete when:

- P26–P43 governance detour is removed;
- production architecture is explicitly defined as V2;
- infrastructure work is capped at product-driven maintenance;
- the corrected product roadmap is authoritative;
- future phase numbering resumes from P27.
