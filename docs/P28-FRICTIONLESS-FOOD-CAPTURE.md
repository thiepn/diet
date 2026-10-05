# P28 — Frictionless Food Capture

P28 improves the highest-frequency Diet Copilot workflow without changing the database schema or trusted write RPCs.

## Goals

Food logging should get faster as soon as a food or meal already exists in Diet Copilot.

The default path is:

**Food → type a few characters → Enter**

or:

**Food → frequent/recent item → +**

## Changes

### Local-first keyboard search

Saved foods and meals now rank by:

- exact barcode;
- exact name;
- name prefix / substring;
- brand;
- favorite status;
- use count;
- recent use;
- current meal type for saved meals.

Keyboard behavior:

- `/` focuses food search from the Food page;
- `↑` / `↓` moves through local results;
- `Enter` logs the selected local result immediately;
- `Escape` clears and closes search.

Online Open Food Facts lookup is now the fallback when no local result consumed Enter. This removes the previous conflict where Enter could unnecessarily start an online search despite a local match.

### One-tap repeat

The capture shortcuts now contain **Repeat last**.

It prefers the newest recent meal matching the selected meal type and falls back to the newest meal overall. The existing Recent section remains available for older exact copies.

### Fast portions

Saved foods and saved meals keep their one-tap default `+` action.

A separate **½–2×** action opens a compact portion chooser with:

- ½×;
- 1×;
- 1½×;
- 2×;
- custom multiplier from 0.1× to 10×;
- optional quantity label.

Calories/protein preview update before logging.

This uses the existing canonical `diet_app_log_saved_food` and `diet_app_log_saved_meal` RPC multiplier fields. No new database write path was introduced.

### Rapid successive logging

After logging from search, the query clears and focus returns to search so the next food can be entered immediately.

Quick Add also returns to search after a successful write.

### Mobile behavior

Entering Food on desktop focuses search automatically.

Mobile does **not** force-open the virtual keyboard just because the Food route was opened. Search remains one tap away.

## Safety and correctness

P28 preserves:

- owner-scoped RPC writes;
- uncertain-write reconciliation;
- idempotent request IDs;
- explicit online-food review;
- undo after confirmed logging;
- exact meal edit/delete flows.

There are no Supabase migrations in P28.

## Exit criteria

- local Enter-to-log works before online fallback;
- common saved portions remain one tap;
- alternate portions do not require editing the food library;
- recent meal repeat is one tap;
- keyboard capture is viable on desktop;
- mobile does not auto-open its keyboard;
- both service workers cache the new helper module;
- P13–P27 regression stack remains green.

## Next phase

**P29 — Food Memory & Reuse Intelligence**

P29 should use normal food history to improve defaults: usual portions, repeated combinations, meal templates, duplicate recognition and context-sensitive ordering.
