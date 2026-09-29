# Diet Copilot 2.0 — P4 Food Database, Editing & Logging Workflows

Status: **implemented on `diet-copilot-2.0`**

P4 builds on the P3 secure-write architecture and turns the Food area into a complete correction and food-memory workflow.

## Product outcome

P4 adds:

- logged-meal editing,
- item-level macro editing,
- meal title/type/date correction,
- move meal by changing date,
- copy meal to another date,
- delete logged meal,
- save a historical meal as a reusable saved meal,
- saved-food library,
- saved-food create/edit/delete,
- saved-food favorites,
- saved-meal favorites,
- saved-meal deletion,
- explicit Open Food Facts full-text discovery,
- Open Food Facts barcode lookup,
- serving-size scaling before import,
- review-before-import,
- save-only or save-and-log,
- optimistic concurrency for meal edits, saved-food edits and deletions.

## Product hierarchy

The Food screen keeps the daily path fast:

```text
Food
  ├─ local search
  ├─ frequent foods
  ├─ saved meals
  ├─ recent meals
  ├─ explicit online lookup
  ├─ barcode lookup
  └─ quick add
```

Food-library maintenance is available through:

- Food → **Food library**
- More → **Foods & meals**

This keeps maintenance out of the main one-tap logging path.

## Meal correction

Every logged meal now exposes:

- **Edit**
- **Save meal**

The meal editor supports:

- title,
- log date,
- meal type,
- each item's name,
- quantity,
- calories,
- protein,
- carbs,
- fat,
- fiber,
- add item,
- remove item.

The write submits the complete sanitized item set to the server.

The server does not trust browser totals. The existing private meal writer recalculates canonical meal totals from the submitted item array.

## Move and copy

Changing the editor's log date moves the meal through the existing private update engine.

The editor also has a dedicated **Copy meal** path with a target date.

Copy uses the historical-repeat RPC so the server reconstructs the canonical original meal rather than trusting the browser to duplicate nutrient totals.

## Optimistic concurrency

Logged meals use their last observed `updated_at` in:

`diet_app_update_meal`

and:

`diet_app_delete_meal`

Saved-food edits/deletes use the last observed saved-food `updated_at` in:

- `diet_app_save_food`
- `diet_app_delete_saved_food`

A stale editor therefore receives a conflict instead of silently overwriting a newer change.

## Reusable meals

A logged meal can be saved through:

`diet_app_save_meal_from_history`

The existing private meal-memory implementation remains canonical.

Saved meals can now be:

- favorited,
- unfavorited,
- deleted,
- logged from the normal P3 one-tap workflow.

Deleting a saved meal does not delete historical logged meals.

## Saved-food library

The library shows all owner-scoped saved foods with:

- favorite state,
- name,
- brand,
- calories,
- protein,
- edit,
- delete.

Saved-food editing supports:

- name,
- brand,
- barcode,
- quantity,
- calories,
- protein,
- carbs,
- fat,
- fiber.

Deleting a saved food does not delete historical meals. Existing foreign keys preserve history by clearing the saved-food link where required.

## Open Food Facts integration

P4 adds:

`v2/open-food-facts.mjs`

The adapter is intentionally separate from Diet's canonical storage.

### Barcode lookup

Barcode reads use the Open Food Facts product endpoint.

The result is normalized to:

- barcode,
- product name,
- brand,
- image,
- serving information,
- calories / protein / carbs / fat / fiber per 100 g.

### Full-text search

Local Diet search remains instant and network-free.

Open Food Facts full-text search runs **only after an explicit user action**:

- click **Online**, or
- press Enter in the search box.

P4 does not call an external search endpoint on every keystroke.

The adapter applies a 6.5-second minimum interval between non-cached search requests and caches results for 15 minutes.

### Import review

An external result is never logged immediately.

Selecting a result opens a review screen containing:

- name,
- brand,
- barcode,
- serving grams,
- quantity,
- calories,
- protein,
- carbs,
- fat,
- fiber.

Changing grams recalculates the nutrient values from the product's per-100-g values.

The user can then choose:

- **Save only**
- **Save & log**

### External-data trust

Imported Open Food Facts records use:

`source = open_food_facts`

and default to **medium** confidence.

P4 deliberately does not mark Open Food Facts data as equivalent to a manually verified nutrition label.

The UI also identifies the source and reminds the user to verify the package label.

## Secure mutation surface

P4 keeps the P3 browser security model.

Authenticated clients still have **SELECT-only direct Diet table access**.

The complete browser mutation allowlist is now exactly:

1. `diet_app_log_meal`
2. `diet_app_log_saved_food`
3. `diet_app_log_saved_meal`
4. `diet_app_repeat_meal`
5. `diet_app_delete_meal`
6. `diet_app_update_meal`
7. `diet_app_save_meal_from_history`
8. `diet_app_save_food`
9. `diet_app_set_saved_food_favorite`
10. `diet_app_delete_saved_food`
11. `diet_app_set_saved_meal_favorite`
12. `diet_app_delete_saved_meal`

All are:

- authenticated-only,
- explicitly revoked from `anon`,
- explicitly revoked from `PUBLIC`,
- bound to `auth.uid()`,
- `SECURITY DEFINER`,
- pinned to an empty `search_path`,
- narrowly scoped,
- input-bounded.

No browser service-role or secret key exists.

## P4 database source

Canonical P4 SQL:

`supabase/p4-food-library-write-api.sql`

This file is generated from the verified live function definitions so the repository reflects the canonical database implementation.

## Read model changes

P4 extends read-only owner data with:

### Meal item fields

- `saved_food_id`
- carbs
- fat
- fiber
- `updated_at`

### Saved-food fields

- source
- photo URL
- `updated_at`

### Saved-meal fields

- `updated_at`

These fields support editing and optimistic concurrency without adding direct client write grants.

## Frontend modules

P4 keeps responsibilities separated:

- `v2/data.js` — owner-scoped reads and rendering
- `v2/read-model.mjs` — pure normalization
- `v2/write-api.mjs` — explicit RPC allowlist
- `v2/food.js` — fast daily logging
- `v2/meal-editor.js` — logged-meal correction
- `v2/food-management.js` — food library and external import
- `v2/open-food-facts.mjs` — external discovery adapter

Neither P4 UI module performs direct table mutations.

## Runtime validation

`supabase/tests/p4_food_database_runtime.sql`

runs real authenticated operations in one transaction and rolls everything back.

It verifies:

- P3 manual meal creation,
- P4 meal edit,
- canonical total recalculation,
- save meal from history,
- create imported saved food,
- saved-food favorite,
- concurrency-safe saved-food edit,
- saved-meal favorite,
- invalid barcode rejection,
- saved-food deletion,
- saved-meal deletion,
- logged-meal deletion.

Live result:

`diet_p4_food_database_runtime_ok`

No fixture rows remain after rollback.

## Security contract

`supabase/tests/p4_food_database_contract.sql`

verifies:

- authenticated Diet tables remain SELECT-only,
- the app RPC surface is exactly the expected 12 functions,
- all RPCs are SECURITY DEFINER,
- all explicitly derive ownership from `auth.uid()`,
- anonymous execution is denied,
- PUBLIC execution is denied.

Live result:

`diet_p4_food_database_contract_ok`

## JavaScript regression suite

`tests/v2-food-database.mjs`

checks:

- P4 UI surfaces,
- module loading,
- exact 12-RPC allowlist,
- no table mutation calls in P4 UI modules,
- no privileged browser keys,
- external search isolation,
- search-rate guard,
- barcode endpoint,
- editable nutrient preservation,
- saved-food concurrency metadata,
- Open Food Facts scaling,
- meal-update RPC mapping,
- food-save RPC mapping.

## P4 boundary

P4 intentionally does not yet add:

- AI natural-language meal parsing,
- AI photo estimation,
- automatic recommendation acceptance,
- camera-based barcode scanning,
- a proprietary global food database,
- collaborative/shared foods.

Barcode **lookup** is complete; camera scanning can be layered on top later without changing canonical storage or mutation security.

## Result

P4 completes the manual food-management loop:

```text
discover / recall
      ↓
review
      ↓
log
      ↓
correct
      ↓
save for reuse
      ↓
repeat quickly
```

while preserving Diet Copilot 2.0's key architecture rule:

> **The browser may request a small set of validated owner-bound actions, but canonical Diet tables remain directly read-only.**
