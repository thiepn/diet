# Diet Copilot — V0.5 Release Candidate

Diet Copilot is a mobile-first, local-first calorie/protein/body-weight tracker designed around a simple architecture:

```text
ChatGPT = interpretation and conversation
Supabase = durable shared data
GitHub Pages app = dashboard + manual fallback
```

V0.5 deliberately stops feature expansion and hardens the V0.4 product for a future V1.0.

## V0.5 priorities

### 1. Offline-safe cloud conflicts

V0.4 could surface concurrent edits while both clients were online. V0.5 also protects the offline case.

After cloud data is downloaded, the app stores the server `updated_at` value for every synced row. Queued writes remember that baseline. Before updating/deleting a previously synced row, V0.5 verifies that the cloud row has not changed.

If it changed, sync stops and Settings shows an explicit conflict instead of silently overwriting the newer cloud value.

- **Keep local edits** = intentionally overwrite conflicting rows, then reload unrelated cloud changes.
- **Use cloud** = discard pending transport operations and reload the cloud dataset.

Normal **Sync now** never bypasses conflict detection.

### 2. Queue and foreign-key hardening

V0.5 fixes several lifecycle cases:

- create offline → delete before first sync no longer leaves a useless remote delete
- deleting an unsynced meal also removes queued child-item writes
- deleting a saved food clears queued references to that food
- full cloud replacement uploads parent records before dependent records
- retryable errors and true conflicts are handled separately
- reconnecting automatically resumes safe queued work

### 3. Account/project isolation

Changing Supabase projects, forgetting cloud settings, importing a backup, or signing out disables automatic cloud sync and clears server-baseline metadata.

This prevents a queue created for one cloud account/project from being pushed into another account by accident.

### 4. V0.5 cloud schema gate

V0.5 calls:

```text
diet_copilot_healthcheck()
```

before activating cloud sync. Old V0.4 schemas are rejected until the V0.5 SQL upgrade is installed.

The health check validates:

- schema version
- required ChatGPT RPCs
- authenticated Data API/RLS access
- relational ownership consistency
- basic per-user cloud record integrity

### 5. Relational ownership enforcement

RLS still restricts each exposed row to `auth.uid()`. V0.5 additionally adds owner-consistency triggers so IDs such as:

- `meals.daily_log_id`
- `meal_items.meal_id`
- `meal_items.saved_food_id`
- `saved_meal_items.saved_meal_id`
- `saved_meal_items.saved_food_id`

must point to parent rows owned by the same user.

### 6. Release check inside the app

Open **Settings → V0.5 release check**.

It checks:

- localStorage read/write
- app data version
- duplicate IDs
- meal/item validity
- daily-log links
- day status validity
- weight records
- sync queue consistency
- online/offline state
- runtime storage warnings
- Supabase schema/integrity when cloud mode is active

Safe local structural repairs can be applied from the same card.

### 7. Migration rollback

When V0.5 first migrates an older local version, it stores a one-time pre-migration snapshot in browser storage.

Settings exposes **Restore pre-V0.5 backup** when that snapshot exists.

Manual JSON export/import remains available.

### 8. Long-history performance

History now renders 30 days at a time and progressively loads more. Search still checks the full local history.

### 9. Accessibility / reduced motion

V0.5 adds:

- visible keyboard focus states
- `aria-current` navigation state
- reduced-motion support
- responsive release-check rows

## Core features retained

- Today calorie/protein dashboard
- date-aware targets
- Open / Complete / Partial day status
- weight logging + 7-entry trend
- item-level meals
- calorie uncertainty ranges
- saved foods
- saved meals / usuals
- Yesterday / Recent quick logging
- history search
- AI action audit + undo
- JSON backup/import
- optional Supabase auth/sync
- PWA/offline shell
- ChatGPT read/search/create/update/delete/weight/undo RPC contract

## Run locally

```bash
cd diet-copilot-v0.5
python -m http.server 8080
```

Open `http://localhost:8080`.

Opening `index.html` directly still supports local tracking, but service-worker/PWA behavior requires HTTP(S).

## GitHub Pages

There is no build step. Put the project files at the repository root and enable GitHub Pages.

The browser SDK is pinned to `@supabase/supabase-js@2.116.0`.

## Supabase installation

### Fresh project

Run:

```text
supabase/schema.sql
```

### Upgrade from V0.4

Run:

```text
supabase/upgrade-v0.4-to-v0.5.sql
```

### Upgrade directly from V0.3

Run:

```text
supabase/upgrade-v0.3-to-v0.5.sql
```

The older `upgrade-v0.3-to-v0.4.sql` is retained for historical/reference use.

After upgrading:

1. Open V0.5.
2. Sign in.
3. Run **Settings → V0.5 release check**.
4. Confirm the cloud row reports **Schema v5**.
5. Choose an explicit first-sync direction if cloud sync is not already activated.

## Supabase security requirements

The static frontend must use only the project URL plus a **publishable key**. Never put a secret/service-role key into GitHub Pages.

The schema uses both explicit Data API grants and RLS. This is intentional: current Supabase projects can require explicit grants for newly created public tables, while RLS independently controls which rows an authenticated user may access.

## ChatGPT boundary

The app does not embed an OpenAI API key and publishing it does not automatically grant a normal ChatGPT conversation browser control.

The intended integration is:

```text
ChatGPT / authenticated connector
              │
              ▼
      Supabase RPC + RLS
              │
       shared diet records
              │
              ▼
       GitHub Pages app
```

See:

- `supabase/chatgpt-bridge.md`
- `supabase/photo-estimate-contract.md`

## V1.0 acceptance criteria

V0.5 should graduate to V1.0 only after real-device testing confirms all of the following:

1. Fresh local install works.
2. V0.4 local data migrates without changing totals.
3. Fresh Supabase schema passes the release check.
4. V0.4 → V0.5 database migration passes the release check.
5. First upload and first download both work.
6. Android + desktop edits synchronize correctly.
7. Offline edits synchronize after reconnect.
8. Offline conflicting edits produce a conflict instead of an overwrite.
9. ChatGPT RPC create/correct/delete/undo works end-to-end.
10. No high-severity findings remain in Supabase Security Advisor.

See `QA.md` for the manual release matrix.
