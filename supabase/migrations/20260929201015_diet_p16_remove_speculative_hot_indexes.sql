-- P16: remove speculative indexes after the production advisor reported no usage.
-- Existing owner/date/relationship indexes plus explicit owner predicates are sufficient
-- for the current workload; avoid unnecessary write amplification.

drop index if exists public.meal_items_owner_sort_p16;
drop index if exists public.saved_foods_owner_rank_p16;
drop index if exists public.saved_meals_owner_rank_p16;

analyze public.meal_items;
analyze public.saved_foods;
analyze public.saved_meals;
