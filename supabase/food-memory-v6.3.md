# Diet Copilot V6.3 — Food Intelligence & Memory 2.0

V6.3 improves memory without adding any manual logging workflow to the dashboard.

## Product boundary

Food is still logged by talking directly to ChatGPT. The dashboard remains read-only. Food aliases, normal portions and recurring meal patterns are learned from normal logging rather than requiring a separate maintenance screen.

## Search remembered foods

```sql
select private.search_food_memory(p_query, p_limit);
```

Search now considers exact barcode, exact name, aliases, brand, favorite status, use count and recent use. Results include the learned usual portion when one is available.

## Barcode memory

```sql
select private.get_saved_food_by_barcode(p_barcode);
select private.verify_saved_food_barcode(p_saved_food_id,p_barcode,p_request_id);
```

A verified Diet Copilot barcode match outranks crowd-sourced barcode databases. Barcode verification is idempotent and refuses collisions with another saved food.

## Alias learning

```sql
select private.teach_food_alias(p_saved_food_id,p_alias,p_request_id);
```

Use this when the user gives a natural shorthand such as “my protein yogurt” or “same chicken.” Exact aliases are prevented from pointing to two different saved foods.

## Favorites

```sql
select private.set_saved_food_favorite(p_saved_food_id,p_favorite,p_request_id);
```

Favorites influence search/ranking but do not change nutrition values.

## Automatic usual-portion learning

`public.saved_food_portions` stores learned multipliers and quantity labels for remembered foods. A database trigger learns these automatically whenever a logged meal item references a saved food.

No extra user action is required. Retries do not duplicate portion learning because idempotent meal logging does not create a second meal item.

The dashboard may read owner-scoped portion rows but cannot write them.

## Memory intelligence

```sql
select private.get_food_memory_intelligence(p_days,p_limit);
```

The snapshot includes:

- saved-food count
- favorite count
- alias count
- verified-barcode count
- learned usual portions
- most-used foods
- protein/fiber efficiency context
- repeated food + meal-type patterns
- repeated food pairings

Patterns are descriptive, not rules. Diet Copilot should not assume the user wants a recurring meal merely because it appeared several times.

## Decision-engine integration

V6.2 saved-food suggestions now evaluate the learned usual amount where available instead of blindly assuming the saved base portion. This makes projected calories/protein/fiber closer to the amount the user normally eats.

The system must still ask when the user explicitly describes a materially different portion.
