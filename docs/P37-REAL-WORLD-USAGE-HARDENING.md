# P37 — Real-World Usage Hardening

P37 is a defect-and-resilience phase. It does not add a new product area.

It hardens the paths that are easy to miss in feature-by-feature development but occur during actual daily use: long sessions, account changes, flaky connectivity, ambiguous writes, repeated background refresh triggers, midnight rollover and an update arriving while a form is being edited.

## Owner transition isolation

P37 records which authenticated owner produced the currently rendered private model.

If the browser session changes to another canonical Account UUID, Diet drops the previous owner's loaded model **before** attempting cache or cloud recovery for the new owner.

A failed read for the new account therefore cannot leave the prior account's nutrition model visible.

Cached snapshots remain owner-matched. A same-owner in-memory snapshot may be retained as read-only stale data when a live refresh fails.

## Stale in-memory fallback

When the current owner already has a verified model in memory and a later cloud refresh fails without a usable persistent cache, Diet now keeps that model explicitly as:

`source = memory`

That state is read-only. Normal write readiness continues to require `source === cloud`.

The Settings and diagnostics surfaces distinguish the last in-memory snapshot from live sync and offline cache.

## Write reconciliation

The existing mutation request IDs remain the server-side idempotency basis.

P37 adds three client safeguards:

1. only genuinely transient transport/server failures are retried;
2. one Diet write may be active at a time across product surfaces;
3. an uncertain write guard is persisted in **sessionStorage** across page reloads.

The persisted guard contains only:

- RPC name;
- random mutation request ID;
- timestamp;
- sanitized operational error code.

It does not persist meal contents, calories, protein, titles, tokens or raw backend error messages.

After an uncertain write, all subsequent mutations remain blocked until a successful owner refresh reconciles the UI and clears the guard.

Deterministic PostgREST errors such as schema/request failures are no longer automatically retried and falsely promoted to an uncertain-write state.

## Refresh coalescing

Real use can generate the same refresh from several sources almost simultaneously:

- reconnecting to the network;
- returning to the tab;
- BFCache restore;
- realtime mutation notification.

P37 coalesces background refreshes into one active request with at most one queued follow-up.

Explicit user refresh remains immediate.

This reduces duplicate network work while retaining the request-epoch protection already used to reject stale results.

## Midnight rollover

A PWA can remain open across midnight.

P37 tracks the local calendar day while the document is visible. When the date changes:

- Today's label is refreshed;
- a `diet-v2-day-rollover` event is emitted;
- the current owner snapshot is refreshed;
- Today, food-date logic and adaptive read models move to the new date without requiring a manual reload.

No background write is performed.

## Unsaved input and PWA updates

P37 tracks user edits in the highest-risk forms:

- Quick add;
- portion logging;
- meal editor;
- onboarding/plan setup;
- saved-food editor.

Dirty edits activate the normal browser unload guard.

If a PWA update becomes ready while an edit is active, **Reload update** refuses to reload and asks the user to finish or discard the edit first.

Successful form reset or dialog close clears the dirty marker.

## Write readiness

Food logging, meal editing, saved-food/meal management and training changes now honor the global write guard before calling the mutation layer.

This prevents a second screen from starting another mutation while the first is active or awaiting reconciliation.

## Performance

The existing raw core ceiling remains **750,000 bytes**.

Observed P37 raw core size: **749,406 bytes**.

The budget is not increased.

## Boundaries

P37 does not:

- add product features or screens;
- change nutrition calculations;
- add background nutrition writes;
- weaken idempotency/concurrency controls;
- introduce cross-account data sharing;
- persist nutrition payloads in the new write guard;
- force-update the PWA while the user is editing;
- change Account authority or authentication.

## Next phase

**P38 — Product Release Candidate**
