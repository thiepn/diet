# V0.4 photo-estimate contract

Meal photographs are treated as **estimation evidence**, not exact nutritional measurements.

## Minimum structured output

```json
{
  "meal_type": "Lunch",
  "title": "Chicken rice bowl",
  "confidence": "medium",
  "source": "photo_estimate",
  "original_input": "[meal photo] Lunch",
  "notes": "Oil and sauce amount cannot be measured visually.",
  "items": [
    {
      "name": "Chicken",
      "quantity": "~220 g cooked",
      "calories": 360,
      "protein": 68,
      "calories_low": 320,
      "calories_high": 410,
      "confidence": "medium",
      "source": "photo_estimate"
    }
  ]
}
```

## Confidence

**High**
- readable nutrition label
- weighed quantity shown/provided
- known saved food/meal

**Medium**
- components visible
- ordinary portion sizes can be estimated reasonably
- hidden oil/sauce is limited

**Low**
- buffet/mixed dish
- components largely obscured
- large uncertainty in oil, cream, dressing, cheese, or serving size

## Range rules

Use `calories_low` / `calories_high` when the plausible error is material.

The central `calories` value should be a reasonable midpoint estimate, not a fake precise measurement.

Examples:

```text
Packaged Skyr with readable label
158 kcal · high confidence · no range needed
```

```text
Restaurant curry
760 kcal · likely 600–950 kcal · low/medium confidence
```

## Clarification threshold

Ask the user only when one answer could materially change the result, such as:

- "Did you eat the whole plate?"
- "Was that creamy sauce or tomato-based sauce?"
- "Was the rice roughly one cup or two?"

Otherwise log the estimate with a range and continue.

## Image retention

V0.4 does not require permanent image storage. The persistent record can contain the structured estimate, original text description, confidence and assumptions while the source photo remains only in the ChatGPT conversation.
