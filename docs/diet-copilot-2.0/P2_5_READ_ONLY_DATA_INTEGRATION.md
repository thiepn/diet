# Diet Copilot 2.0 — P2.5 Read-Only Data Integration

Status: **implemented on `diet-copilot-2.0`**

P2.5 connects the isolated Diet Copilot 2.0 shell to the existing THIEPN Account / shared Supabase backend without introducing canonical nutrition writes.

## Scope

P2.5 reads:

- `profiles`
- `daily_logs`
- `meals`
- `meal_items`
- `weight_entries`
- `goal_phases`

The browser client receives only the existing `authenticated SELECT` grants. RLS remains responsible for owner isolation.

P2.5 does **not** call:

- `insert()`
- `update()`
- `upsert()`
- `delete()`
- mutation RPCs
- `service_role`

No Supabase schema, policy, grant, or function change is required.

## Account/session behavior

V2 reuses the same canonical Supabase session key as V1:

`sb-hycegznamzjhwinegaai-auth-token`

It also understands the existing resilient cookie fallback used by the production Diet Copilot account implementation. This means the preview can consume an already-established THIEPN account session on the same origin without introducing a second independent account.

P2.5 does not implement a second OAuth callback flow:

- `detectSessionInUrl: false`
- existing session is obtained with `auth.getSession()`
- while online, identity is verified with `auth.getUser()` before private cloud data is loaded

The locally stored session user ID may be used while offline only to select the matching owner-scoped cache. It is not used as an authorization decision for remote data.

If no session exists, V2 hides all private nutrition surfaces and directs the user to the established production account flow.

## Owner-scoped cache

Cache key:

`diet-copilot-v2-read-cache-v1`

The cache stores the raw read snapshot together with:

- schema/cache version,
- owner ID,
- save timestamp.

A cache is used only when:

`cached.ownerId === currentSessionOwnerId`

An account switch therefore cannot display the previous owner's cached history.

Offline states:

- session + matching cache -> show owner-matched cache
- session + no matching cache -> no private data
- no session -> no private data

## Private-view scrubbing

P2.5 explicitly clears rendered private information whenever no owner-matched model is available.

The scrub replaces:

- daily calories,
- protein,
- trend weight,
- expenditure,
- meal rows,
- food history,
- progress charts,
- goal projection,
- strategy values,
- recommendation values.

This prevents a sign-out or failed account switch from leaving the previous owner's data visible in the DOM.

## Read model

`v2/read-model.mjs` is the only translation layer between legacy rows and the 2.0 product surfaces.

Pipeline:

```text
owner-scoped Supabase SELECT rows
        ↓
normalize V1 relationships
        ↓
P1.5 legacy-data adapter
        ↓
P1 adaptive nutrition engine
        ↓
Diet Copilot 2.0 read model
        ↓
Today / Food / Progress / Strategy
```

The UI therefore does not independently calculate TDEE, trend weight, confidence, or target recommendations.

## Today integration

Today now displays real read-only values for:

- consumed calories,
- current calorie target,
- calories remaining/over,
- protein consumed / target,
- current trend weight,
- latest raw scale weight,
- adaptive expenditure,
- expenditure uncertainty range,
- confidence,
- today's meal list,
- goal mode,
- current target.

Unavailable metrics remain visibly unavailable rather than being invented.

## Food integration

P2.5 connects the real **today meal timeline**.

Each row may show:

- meal type/title,
- time,
- calories,
- protein,
- up to four logged food items.

All food actions remain preview-only in P2.5. Search, saved meals, barcode entry and natural-language logging are P3 work.

## Progress integration

The Progress screen now consumes:

- raw weigh-ins,
- P1 trend weight,
- P1 adaptive expenditure series,
- historical intake vs target,
- P1 goal projection.

Range controls are active:

- 4 weeks
- 3 months
- 6 months
- 1 year

The default is 3 months.

The charts are generated from the normalized read model; chart code does not query Supabase directly.

## Strategy integration

Strategy now displays:

- goal mode,
- goal weight,
- selected weekly rate,
- estimated expenditure,
- current calorie target,
- confidence,
- P1 recommendation decision,
- recommendation rationale,
- recommended target.

P1 remains non-authoritative. Displaying a recommendation does not apply it.

## Realtime behavior

After a successful owner-verified read, P2.5 subscribes read-only to Postgres change notifications for the six Diet tables.

When the canonical Diet logger changes a row:

1. the event is received through the existing RLS-protected Realtime channel;
2. refreshes are debounced;
3. P2.5 re-fetches owner-scoped SELECT data;
4. the read model is recomputed;
5. the visible shell updates.

P2.5 never sends database mutation events.

## Data states

The shell distinguishes:

- Connecting
- Refreshing
- Live
- Offline cache
- Cached/stale
- Sign in required
- Offline without cache
- Data unavailable

The banner disappears in the ordinary Live state but remains visible whenever user attention is useful.

## Live production-data validation

The exact P2.5 read-model implementation was executed against a transient read-only snapshot from the canonical Supabase project.

Validation confirmed that the model can resolve:

- active goal phase,
- daily targets,
- meal relationships,
- meal-item relationships,
- weight history,
- P1 trend weight,
- P1 adaptive expenditure,
- P1 confidence,
- P1 strategy decision,
- progress series,
- goal projection.

No raw production nutrition or weight rows were committed to the repository.

## Security posture

P2.5 preserves the P0 model:

- `anon`: no Diet table access
- `authenticated`: SELECT only
- RLS owner predicate
- no browser service-role key
- no browser canonical writes
- no new privileged RPC
- no schema modification

The public client uses the current Supabase **publishable** key, not a service-role or secret key.

## Regression coverage

`tests/v2-read-integration.mjs` verifies:

- deterministic read-model output,
- correct meal/item relationship mapping,
- active goal phase mapping,
- current target mapping,
- future-row exclusion,
- P1 integration,
- all six SELECT-only data sources,
- explicit ban on browser writes,
- identity verification via `auth.getUser()`,
- canonical session reuse,
- no duplicate OAuth callback handling,
- owner-matched offline cache,
- resilient V1 cookie compatibility,
- Realtime refresh,
- live Progress ranges,
- private-view scrubbing,
- required UI bindings.

## P2.5 boundary

P2.5 still does not provide:

- food search,
- food creation,
- meal mutation,
- barcode logging,
- saved-meal logging,
- weight entry,
- goal editing,
- recommendation acceptance,
- AI meal logging.

Those belong to later mutation/workflow phases.

## Result

**P2.5 provides a real, owner-scoped, read-only Diet Copilot 2.0 experience while leaving V1 production authority and all canonical write paths unchanged.**
