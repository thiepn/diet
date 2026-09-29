# P12 — Production Promotion & Safe Cutover

Date: 2026-09-29

## Objective

Promote the P11-certified Diet Copilot 2.0 release candidate from `/diet/v2/` to the canonical production URL `/diet/` without changing the canonical Supabase data model or removing the previous frontend rollback path.

## Cutover design

1. The canonical root renders the 2.0 shell while reusing the versioned modules under `/v2/`.
2. The root manifest and root service worker belong to Diet Copilot 2.0.
3. `/diet/v2/` remains a functional stable compatibility route with a narrower worker/cache family.
4. The former V1 root HTML is frozen as `/diet/legacy-v1.html`; its JS/CSS bundles remain available.
5. The shared OAuth relay returns `web-v2` callbacks to the canonical `/diet/` URL.
6. P12 certification validates canonical routing, OAuth, mobile layout, alias behavior, rollback availability and offline production behavior.

## Non-goals

P12 performs no database migration, RLS change, account mutation, nutrition correction, target rewrite or Health Connect change. It is a frontend release promotion only.

## Rollback invariant

A frontend regression must be handled by switching or reverting frontend code. Production nutrition data must never be reset as a rollback mechanism.
