# Diet Copilot V6.4 — Reliability, Reconciliation & Data Integrity

V6.4 hardens the invisible ChatGPT → Supabase → dashboard pipeline. It does **not** add a dashboard logging workflow.

## Exactly-once writes

Every ChatGPT mutation uses a stable, non-empty `p_request_id`. The pair `(user_id, request_id)` is unique in `public.ai_actions`.

If a call is retried after a timeout or transport error, **reuse the same request ID**. Never create a new request ID just because the first call returned an uncertain result.

To recover uncertain state:

```sql
select private.get_action_status(p_request_id);
```

If `found = true`, the action already committed. Do not write it again.

## Meal duplicate preflight

Before a new meal write, use:

```sql
select private.preflight_meal_write(
  p_log_date,
  p_meal_type,
  p_title,
  p_items,
  p_request_id
);
```

Possible duplicates are advisory. Do not auto-delete or auto-block a legitimate repeat meal. Explicit language such as “another 50 g” means a second meal is intentional and should use a new request ID.

## Post-write verification

V6.4 meal, meal-correction, meal-deletion, weight and day-status helpers verify their own persisted result before returning success. A failed verification raises and rolls the transaction back.

Verification can also be requested directly:

```sql
select private.verify_ai_action(p_request_id);
```

For meals this checks that the entity exists and that meal calories/protein agree with the stored item totals. Delete actions verify the deleted meal no longer exists.

## Natural corrections

When the user says things such as:

- “Actually it was 100 g, not 50 g.”
- “Remove the yogurt.”
- “That lunch was closer to 1,100 kcal.”

Treat the message as a correction, not as a new meal.

Locate candidates with:

```sql
select private.find_recent_meals_for_correction(p_query, p_date, p_limit);
```

Use the returned `meal_id` and `updated_at` with `private.update_meal` or `private.delete_meal`. If more than one candidate is genuinely plausible, clarify instead of guessing.

## Audit trail

```sql
select private.get_audit_trail(p_limit);
```

`public.ai_actions` stores request ID, action type, entity, before/after state, timestamp and undo metadata. Meal updates/deletions preserve the prior meal plus item state.

## Integrity report

```sql
select private.get_integrity_report(p_start_date, p_end_date);
```

The report checks:

- meal totals vs meal-item totals,
- broken action/entity links,
- broken saved-food references,
- possible exact duplicate meal groups.

Possible duplicate groups are **advisory only** because repeated identical foods can be intentional.

## Deterministic reconciliation

Dry run:

```sql
select private.reconcile_integrity(p_start_date, p_end_date, false, null);
```

Apply safe repairs:

```sql
select private.reconcile_integrity(
  p_start_date,
  p_end_date,
  true,
  p_request_id
);
```

Automatic reconciliation only repairs deterministic meal-total mismatches from their existing item rows. It does not auto-delete suspected duplicate meals.

## Health check

```sql
select private.diet_v64_healthcheck();
```

This reports the V6.4 schema version, request-ID enforcement, integrity summary and supported recovery capabilities.

## Dashboard freshness

The browser remains read-only. V6.4 silently refreshes canonical state when the PWA returns to the foreground or reconnects after being offline, and rebuilds Realtime subscriptions after reconnect. Static dashboard assets use network-first fetching so an old PWA cache is less likely to keep stale UI or backend logic.

## Product boundary

```text
User → ChatGPT → canonical Supabase backend → read-only dashboard
```

No Quick Capture card, dashboard entry form, confirmation queue or manual retry screen should be added.
