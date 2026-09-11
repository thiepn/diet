# Diet Copilot — Live ChatGPT bridge

## Product boundary

Diet Copilot is intentionally split into three layers:

```text
User → ChatGPT → Supabase → read-only dashboard
```

The browser is not a calorie-entry application. Nutrition and weight records are written by ChatGPT through the connected Supabase management integration. The browser receives SELECT-only access to the user's own rows through RLS.

## Live project

- Supabase project: `Diet Copilot`
- Project ref: `mrrqsqawwxwebsdmrnre`
- Region: `eu-central-1`
- Canonical dashboard: `https://thiepn.dev/diet/`
- Browser API key: publishable key only; never expose a secret/service-role key

## Security model

Public tables are protected by RLS. Authenticated browser sessions can SELECT only rows owned by `auth.uid()`.

Browser sessions cannot INSERT, UPDATE, or DELETE nutrition records and cannot execute the write bridge.

ChatGPT write helpers live in the non-exposed `private` schema. They are not granted to `anon` or `authenticated`; they are intended to be called only through the trusted Supabase management/database connection available to ChatGPT.

The current setup is intentionally single-owner. `private.resolve_owner()` requires exactly one Supabase Auth user and refuses to proceed if more than one exists.

## Core ChatGPT functions

### Read context

```sql
select private.get_context(p_end_date, p_days);
```

Use this before answering questions about today's remaining calories, recent adherence, protein intake, or weight history.

### Search meal history

```sql
select private.search_history(p_query, p_days, p_limit);
```

Search before an ambiguous correction such as “that Döner was actually 900 kcal” or “same curry as Tuesday.” Do not guess between multiple plausible meals.

### Log a meal

```sql
select private.log_meal(
  p_log_date,
  p_meal_type,
  p_title,
  p_items,
  p_confidence,
  p_source,
  p_original_input,
  p_notes,
  p_request_id
);
```

Each item should contain structured fields where available:

```json
{
  "name": "Cooked rice",
  "quantity": "~220 g",
  "calories": 285,
  "protein": 6,
  "calories_low": 250,
  "calories_high": 325,
  "confidence": "medium",
  "source": "photo_estimate"
}
```

`p_request_id` must be stable across retries of the same logical user instruction. The bridge is idempotent and returns the original result rather than creating a duplicate.

### Correct a meal

First read/search the meal and keep its latest `updated_at`, then call:

```sql
select private.update_meal(
  p_meal_id,
  p_patch,
  p_items,
  p_expected_updated_at,
  p_request_id
);
```

For item corrections, send the complete corrected item array. `p_expected_updated_at` provides stale-write protection.

To move a meal to another date, include:

```json
{ "log_date": "2026-09-10" }
```

inside `p_patch`.

### Delete a meal

```sql
select private.delete_meal(
  p_meal_id,
  p_expected_updated_at,
  p_request_id
);
```

Never delete a historical meal based only on a guessed title.

### Log or correct weight

```sql
select private.log_weight(
  p_entry_date,
  p_weight,
  p_notes,
  p_request_id
);
```

Weight is unique per user/date, so a later value for the same date updates that day's entry and records the previous value in the audit ledger.

### Undo a ChatGPT action

Every ChatGPT write creates an `ai_actions` entry. To undo a supported action:

```sql
select private.undo_action(p_action_id);
```

Supported cases:

- meal create
- meal update
- meal delete
- weight create
- weight update

## Confirmation policy

Do not ask for confirmation for ordinary low-risk logging when intent is clear.

Clarify only when ambiguity could materially change the record, for example:

- it is unclear whether the full photographed portion was eaten
- a large amount of oil/sauce cannot be reasonably estimated
- multiple historical meals could match a correction

Approximation alone is not a reason to interrupt. Store a confidence level and low/high calorie range instead.

## Photo policy

For meal photos, estimate item-by-item where possible and store:

- food name
- estimated quantity
- central calorie estimate
- protein estimate
- calorie low/high range when useful
- confidence
- source/assumptions

See `photo-estimate-contract.md`.

## Response after a write

Keep confirmations compact. Example:

```text
Logged lunch: ~805 kcal, ~45 g protein (medium confidence; likely 690–945 kcal).
Today: 1,520 / 2,300 kcal · 780 kcal remaining.
```

Always derive totals from Supabase rather than conversational memory.

## Verification status

The live bridge was tested on 2026-09-11 using rollback transactions. The verified cycle was:

```text
create → idempotent retry → search → update → delete → undo delete → undo update
```

Meal and weight tests left zero test rows or audit records after rollback.
