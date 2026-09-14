# Diet Copilot V6.8 / Web 1.0 Backend Certification

Date: 2026-09-14

## Product boundary

- canonical project: `hycegznamzjhwinegaai`
- retired project: `mrrqsqawwxwebsdmrnre`
- browser dashboard remains owner-scoped read-only
- privileged writes remain private
- every mutation requires a stable nonblank request ID
- retries reuse the same request ID
- post-write verification remains required
- no dual-write path exists

## Metrics policy

- every day with logged intake contributes to nutrition analysis
- Open / Partial / Complete status is coverage metadata only
- every available weigh-in contributes to weight evidence
- missing fiber remains unknown rather than zero
- known fiber values still contribute when full coverage is unavailable
- estimated meals count normally; uncertainty affects confidence rather than inclusion

## Production integrity scan

30-day `private.get_integrity_report(...)` result on 2026-09-14:

- meal/item total mismatches: **0**
- broken action links: **0**
- broken saved-food references: **0**
- deterministic repairs required: **0**
- possible duplicate groups: **1**

The single duplicate candidate is the two intentional 50 g `dmBio Knabber Tiere` snack logs from 2026-09-13. They must remain separate records; advisory duplicate detection correctly does not delete them.

## Current coaching baseline check

The production coaching engine correctly remains in **Building baseline / Need more data** state with the current short history:

- 3 logged intake days
- 12 meals
- 67% exact/reused meals
- material calorie-estimate uncertainty
- 3 weigh-ins spanning 2 days
- desired pace: -0.5 kg/week
- no observed weekly pace is treated as established yet

No calorie-target adjustment is justified from this dataset.

## RLS and browser-write check

- Diet public tables checked with RLS enabled: **13 / 13**
- authenticated Diet write policies detected: **0**

## Security advisor

The final V6.8 audit found no new Diet-specific security warning. Existing advisor notices concern shared-project systems outside Diet Copilot or project-wide Auth configuration. `private.diet_operator_owner` intentionally has RLS enabled without an authenticated policy because it is private operator metadata.

## Web 1.0 certification invariants

The stable CI rejects regressions that would reintroduce:

- dashboard Quick Capture
- manual food-entry controls
- complete-only nutrition inclusion
- missing-fiber-as-zero behavior
- duplicate destruction based only on matching nutrition values
- immature weight trends presented as established
- automatic target changes
- legacy Supabase runtime configuration

This document records the backend state used to certify Diet Copilot Web `1.0.0`.
