# Diet Copilot V0.5 — ChatGPT bridge contract

## Purpose

ChatGPT is the interpretation layer. Supabase is the durable source of truth. The browser app is a dashboard/manual fallback.

A ChatGPT integration should **read before it writes**, use the authenticated user's normal JWT/RLS context, and never use a service-role key for routine user actions. Before normal use, call `diet_copilot_healthcheck()` and require `schema_version >= 5`.

## Required workflow

### 1. Read current context

Call:

```text
get_diet_context(p_end_date, p_days)
```

Typical values:

```json
{
  "p_end_date": "2026-09-11",
  "p_days": 14
}
```

The result includes:

- current targets
- today's totals
- recent day summaries
- recent weights
- today's meals/items
- frequent saved foods/meals
- recent AI actions

### 2. Search when a correction is ambiguous

Before statements such as:

> "Actually that Döner was 900 calories."

or:

> "Same curry as last Tuesday."

use:

```text
search_diet_history(p_query, p_days, p_limit)
```

Do not guess which historical meal the user means if multiple plausible records exist.

## Create meal

RPC:

```text
log_meal_from_ai(...)
```

Example payload:

```json
{
  "p_log_date": "2026-09-11",
  "p_meal_type": "Lunch",
  "p_title": "Chicken curry with rice",
  "p_items": [
    {
      "name": "Chicken curry",
      "quantity": "~350 g",
      "calories": 520,
      "protein": 39,
      "calories_low": 440,
      "calories_high": 620,
      "confidence": "medium",
      "source": "photo_estimate"
    },
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
  ],
  "p_confidence": "medium",
  "p_source": "photo_estimate",
  "p_original_input": "[meal photo] Lunch",
  "p_notes": "Portions estimated visually; oil amount uncertain.",
  "p_request_id": "chat-20260911-message-184-meal-1"
}
```

### Idempotency rule

`p_request_id` should be unique for one logical user instruction and stable across retries.

If a network retry resubmits the same request ID, the database returns the original entity instead of creating another meal.

## Correct meal

First read/search the meal and preserve its `updated_at` value.

Then call:

```text
update_meal_from_ai(
  p_meal_id,
  p_patch,
  p_items,
  p_expected_updated_at,
  p_request_id
)
```

Example: user says, "Actually I only ate half the rice."

Send the complete corrected item array, not an ambiguous arithmetic instruction:

```json
{
  "p_meal_id": "...",
  "p_patch": {
    "source": "ai_adjusted",
    "notes": "Rice corrected after user clarification."
  },
  "p_items": [
    {
      "name": "Chicken curry",
      "quantity": "~350 g",
      "calories": 520,
      "protein": 39,
      "calories_low": 440,
      "calories_high": 620,
      "confidence": "medium",
      "source": "photo_estimate"
    },
    {
      "name": "Cooked rice",
      "quantity": "~110 g",
      "calories": 143,
      "protein": 3,
      "calories_low": 125,
      "calories_high": 165,
      "confidence": "medium",
      "source": "ai_adjusted"
    }
  ],
  "p_expected_updated_at": "2026-09-11T12:31:18.123Z",
  "p_request_id": "chat-20260911-message-191-correction-1"
}
```

If the meal changed after it was read, the RPC raises a conflict instead of overwriting it.

### Moving a meal to another date

Set:

```json
{
  "p_patch": { "log_date": "2026-09-10" }
}
```

V0.4 creates/reuses the correct `daily_logs` row and moves the meal to it.

## Delete meal

Call:

```text
delete_meal_from_ai(p_meal_id, p_expected_updated_at, p_request_id)
```

Use the timestamp from the most recent read. Do not delete based only on a guessed title.

## Log weight

```text
log_weight_from_ai(p_entry_date, p_weight, p_notes, p_request_id)
```

The `(user, date)` weight entry is upserted, and the action is written to the AI audit ledger.

## Undo

Each AI action is stored in `ai_actions`.

To revert one:

```text
undo_ai_action(p_action_id)
```

Supported V0.4 undo cases:

- meal create → removes the created meal
- meal update → restores prior meal + items
- meal delete → restores prior meal + items
- weight create → removes it
- weight update → restores prior value

An action can only be undone once.

## Confirmation policy

The conversational assistant should not ask for confirmation for ordinary low-risk logging when the user's intent is clear.

Clarify before writing when uncertainty changes the estimate materially, for example:

- unknown large sauce/oil quantity
- unclear whether the user ate the whole photographed portion
- multiple similarly named historical meals during a correction

Do not ask merely because a calorie value is approximate. Save an uncertainty range instead.

## Photo estimation policy

For a photo, return:

- item name
- estimated quantity
- central calories
- protein
- low/high calorie range when uncertain
- confidence
- assumptions

Do not present a visually estimated meal as exact.

See `photo-estimate-contract.md`.

## Recommended ChatGPT response after a write

Keep it compact:

```text
Logged lunch: ~805 kcal, ~45 g protein (medium confidence; likely 690–945 kcal).
Today: 1,520 / 2,300 kcal · 780 kcal remaining.
```

The database is authoritative; do not rely on chat memory for earlier totals.
