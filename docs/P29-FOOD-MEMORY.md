# P29 — Food Memory & Reuse Intelligence

P29 makes Diet Copilot faster through normal use. It does not create a second food database, add opaque AI guesses, or require a Supabase migration.

## Principles

Food memory is deterministic and evidence-gated.

A single meal never changes a default.

Diet Copilot learns only from already-owned meal history and saved-food references.

## Learned usual portions

For each saved food, P29 inspects recent meal items linked to that saved food.

A learned portion becomes eligible only when:

- at least three usable observations exist;
- at least two thirds of observations agree within a tight tolerance;
- the inferred multiplier remains within the existing safe 0.1×–10× range.

The usual multiplier is derived from the saved food's canonical nutrition values and the nutrition values actually logged in history.

When evidence is sufficient:

- the food card shows the learned multiplier;
- the one-tap add action uses that multiplier;
- Enter-to-log from search uses that multiplier;
- the portion chooser opens on that learned value;
- the most common matching quantity label is reused when available.

If evidence is weak or inconsistent, the default remains exactly 1×.

## Context-aware reuse

Quick foods are now ranked using both explicit preferences and actual meal context:

- favorite status;
- use count;
- how often the food appeared in the selected meal type;
- dominant historical meal type;
- learned-portion confidence.

Saved meals also receive a strong selected-meal-type preference.

This means Breakfast can surface breakfast foods without permanently changing how Lunch or Dinner are ordered.

Search ranking uses the same memory context only as a **bonus after a real query match**. Memory can never create a false search result.

## Recurring meal patterns

P29 groups recent multi-item meals by deterministic composition and meal type.

A pattern appears only after at least two matching historical meals.

The Food page can then:

- repeat the most recent representative meal;
- show how many times the pattern occurred;
- save the recurring pattern as a reusable meal through the existing `diet_app_save_meal_from_history` RPC.

Single-item meals are intentionally excluded because usual-portion memory already handles that case.

## Duplicate recognition

P29 prevents the food library from accumulating obvious duplicates.

A candidate is considered a duplicate only when either:

1. its non-empty barcode exactly matches an existing saved food; or
2. normalized name, brand and quantity all match and calories/protein are within conservative tolerances.

For **Save & log**, an existing food may be reused automatically only when the candidate's available nutrient values scale consistently to the existing saved food. If that scaling is inconsistent, Diet opens the existing item for review instead of guessing.

Open Food Facts results with a known barcode are labelled **Saved** and open the existing food rather than importing another copy.

## Privacy and architecture

All P29 intelligence is calculated locally from the already-loaded owner-scoped read model.

P29 adds:

- no new remote AI call;
- no new tracking;
- no database schema;
- no new write RPC;
- no cross-app dependency.

Canonical Diet RPCs remain authoritative for writes.

## Next phase

**P30 — Onboarding, Goals & Phase Setup**

P30 should make a new or reset account reach a valid nutrition plan with the minimum necessary setup, while clearly explaining what Diet Copilot will learn automatically over time.
