# Diet Copilot 2.0 — P3 Fast Food Logging & Secure Write Architecture

Status: **implemented on `diet-copilot-2.0`**

P3 is the first Diet Copilot 2.0 phase that permits browser-initiated nutrition writes.

The security goal is explicit:

> make food logging fast without granting the browser direct write access to canonical Diet tables.

## Product outcome

The Food screen now supports:

- instant local search across saved foods and saved meals,
- exact barcode-string matching for already-saved barcodes,
- one-tap frequent foods,
- one-tap saved meals / recipes,
- one-tap repeat of recent meals,
- exact Quick add,
- automatic meal-type default based on local time,
- manual Breakfast / Lunch / Dinner / Snack override,
- immediate post-write refresh,
- immediate undo of the last new meal,
- offline / signed-out write blocking.

The primary loop is now:

```text
Food
  -> choose meal type
  -> tap frequent/saved/recent item
  -> canonical write
  -> refresh
  -> optional Undo
```

A common saved food therefore requires one explicit tap after the Food screen is open.

## Existing food memory reused

P3 does not introduce a second food database.

It reads the existing owner-scoped:

- `saved_foods`
- `saved_meals`

alongside the existing meal history.

Frequent-food ordering prefers:

1. favorites,
2. use count,
3. recent use.

Exact manual Quick adds use the canonical `manual_exact` source. The existing private meal writer therefore learns those entries into the existing food-memory system rather than creating a parallel P3-only store.

## Browser table permissions

Authenticated table privileges remain unchanged:

- canonical Diet tables: **SELECT only**
- `anon`: no direct Diet table access
- browser service-role/secret key: none

P3 does not grant `INSERT`, `UPDATE`, `DELETE`, `UPSERT`, or `ALL` on Diet tables to `authenticated`.

## Five app write RPCs

P3 exposes exactly five browser-facing mutation façades:

1. `public.diet_app_log_meal(...)`
2. `public.diet_app_log_saved_food(...)`
3. `public.diet_app_log_saved_meal(...)`
4. `public.diet_app_repeat_meal(...)`
5. `public.diet_app_delete_meal(...)`

Source:

`supabase/p3-app-write-api.sql`

Each function:

- is callable only by `authenticated`,
- is explicitly revoked from `PUBLIC` and `anon`,
- derives the owner from `auth.uid()`,
- fails without authentication,
- pins an empty `search_path`,
- validates / bounds the inputs it accepts,
- never accepts a caller-supplied user ID,
- delegates to the existing private owner-scoped write implementation,
- retains the existing post-write verification ledger.

## Why SECURITY DEFINER is intentional

The browser intentionally has no direct table-write grants.

Therefore the small public façade needs a controlled privileged path into the service-only private write core.

Supabase's security advisor correctly reports these five functions under:

`authenticated_security_definer_function_executable`

This is an intentional finding, not something to suppress blindly.

The design follows Supabase's documented intentional-use case for per-user privileged functions:

- the function is narrow,
- caller identity comes from `auth.uid()`,
- ownership cannot be supplied as a parameter,
- input scope is bounded,
- `PUBLIC` and `anon` execute rights are revoked,
- the underlying table grants remain read-only.

If those conditions change, the warning must be reconsidered.

## Manual-write validation

`diet_app_log_meal` validates:

- authenticated caller,
- request ID format,
- date no more than 31 days back or 1 day forward,
- meal type length,
- title length,
- array payload required,
- 1–25 items,
- item object shape,
- food-name / quantity length,
- numeric macro fields,
- per-item calorie / macro bounds,
- total meal calorie bound.

The server rebuilds a sanitized item array and forces the source to `manual_exact`.

Unsupported caller-supplied keys are not forwarded to the private writer.

## Saved-food / saved-meal validation

Saved-food and saved-meal RPCs accept IDs but verify that the referenced object belongs to `auth.uid()`.

Portion multipliers are constrained to:

`> 0 and <= 20`

The underlying saved-food / saved-meal functions continue to own scaling math and use-count updates.

Recipes continue to use their stored serving semantics.

## Repeat meal

`diet_app_repeat_meal` accepts only an owned historical meal ID.

The server reconstructs the items from canonical `meal_items`; it does not trust the browser to resubmit the old nutrient values.

Owned saved-food links are preserved where available.

## Undo/delete

After a successful write the client keeps:

- returned `meal_id`,
- returned `updated_at`.

Undo calls:

`diet_app_delete_meal(meal_id, expected_updated_at, request_id)`

The private delete implementation performs ownership enforcement and optimistic-concurrency checking before deletion.

## Idempotency

Every P3 mutation uses a request ID shaped like:

`app:<operation>:<uuid>`

The existing write ledger (`ai_actions`) remains authoritative.

The client may retry a transient RPC once with the **same request ID**.

That means a lost response does not require intentionally sending a new write identity.

## Read / write separation in the frontend

Modules:

- `v2/data.js` — owner-scoped reads only
- `v2/read-model.mjs` — pure normalization / nutrition model
- `v2/write-api.mjs` — allowlisted RPC calls only
- `v2/food.js` — Food UX / interactions

The Food UI never calls `.from(...).insert/update/delete`.

The write API never accesses a table directly.

## Food UX

### Search

Search is local and instantaneous over already-loaded owner data.

It ranks:

- exact saved barcode match,
- exact name match,
- prefix match,
- substring match,
- brand match,
- favorite status,
- use count.

No network request occurs per keystroke.

### Frequent foods

The highest-priority saved foods appear immediately in the Food screen.

Tap **+** or the row to log the stored portion.

### Saved meals / recipes

Saved meals are shown separately from foods.

One tap logs:

- one stored meal for ordinary saved meals,
- one serving for saved recipes.

### Recent meals

The recent-history surface logs a server-side canonical copy.

The browser sends only the source meal ID, target date, and chosen meal type.

### Quick add

Quick add requires only:

- food name,
- calories,
- optional quantity,
- optional protein.

This is intended for exact label / known-value entry, not AI estimation.

## Offline behavior

Writes require:

- signed-in owner,
- live cloud source,
- online connection.

A cached/stale read model remains usable for inspection, but P3 refuses canonical writes while the cloud connection cannot be verified.

## Realtime

After a successful write:

1. the client immediately requests a canonical refresh;
2. existing Realtime subscriptions also observe the table change;
3. P1 is recalculated from the refreshed history.

No separate optimistic nutrition totals are persisted.

## Runtime validation

`supabase/tests/p3_app_write_runtime.sql` performs real writes inside one transaction and rolls the transaction back.

It validates:

- manual meal create,
- same-request idempotent replay,
- saved-food logging,
- saved-meal logging,
- historical meal repeat,
- null-items rejection,
- undo/delete.

Live result:

`diet_p3_app_write_runtime_ok`

No fixture records remain after rollback.

## Security contract

`supabase/tests/p3_app_write_contract.sql` verifies:

- authenticated Diet table grants remain SELECT-only,
- all five app RPCs exist,
- all five are SECURITY DEFINER,
- authenticated can execute them,
- anon cannot execute them,
- PUBLIC cannot execute them,
- every function explicitly binds to `auth.uid()`,
- the empty search path remains pinned,
- legacy/service mutation functions remain unavailable to authenticated clients.

Live result:

`diet_p3_app_write_contract_ok`

The original P0 contract also still passes:

`diet_p0_legacy_contract_ok`

## Supabase advisors

Security advisor:

- the five P3 app RPCs appear as intentional authenticated SECURITY DEFINER warnings,
- no new missing-RLS finding was introduced for Diet tables.

Performance advisor:

- no P3-specific performance issue was reported,
- existing project-wide informational findings remain outside this phase.

## Regression coverage

`tests/v2-fast-food.mjs` verifies:

- required Food UI controls,
- meal-type selector,
- one-tap logging surfaces,
- no table access from the write module,
- no privileged keys,
- exact allowlist of five RPCs,
- no direct table-write grants in the SQL source,
- saved-food / saved-meal reads,
- food-memory ranking,
- deterministic read model,
- transient retry,
- same idempotency key on retry.

CI also syntax-checks and publishes:

- `v2/write-api.mjs`
- `v2/food.js`

through the branch's GitHub Pages artifact validation.

## P3 boundary

P3 intentionally does not yet implement:

- external general-food-database search,
- camera barcode scanning,
- AI natural-language meal parsing,
- AI photo estimation,
- full meal editing,
- custom saved-food management,
- recommendation acceptance.

Those capabilities should build on this write architecture rather than bypass it.

## Result

P3 turns Diet Copilot 2.0 from a read-only preview into a usable nutrition logger while preserving the central security property:

> **the browser can request a small set of owner-bound nutrition actions, but it still cannot write Diet tables directly.**
