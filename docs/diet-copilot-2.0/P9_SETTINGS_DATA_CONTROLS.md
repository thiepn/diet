# Diet Copilot 2.0 — P9 Settings, Data Controls & Product Completion

Status: **implemented on `diet-copilot-2.0`**

P9 completes the secondary-product surface that was intentionally kept out of the P2 primary navigation.

The primary application remains:

```text
Today · Food · Progress · Strategy · More
```

P9 does not add another persistent tab or toolbar row.

The principle is:

> **Daily nutrition stays in the five primary surfaces. Configuration, privacy and secondary tools live under More.**

## Scope

P9 turns the remaining placeholder cards in **More** into working product surfaces:

- Foods & meals
- Integrations
- Body & weight
- Account
- Appearance
- Data & export

Foods & meals and Account reuse the existing P4 and account flows.

The new P9 work covers:

- integrations control sheet,
- truthful body/weight summary,
- appearance preferences,
- JSON backup,
- nutrition CSV,
- weight CSV,
- offline-cache controls,
- Copilot session clearing,
- privacy/status visibility.

## No new backend

P9 is intentionally client-side.

It adds:

```text
new Diet tables                 0
new browser RPCs                0
new settings RPCs               0
new export RPCs                 0
new backup RPCs                 0
new cloud appearance settings   0
```

The certified browser mutation surface remains the same 18 `diet_app_*` RPCs from P3/P4/P5/P6.

Appearance preferences are device-local UI preferences, not nutrition data.

Exports are generated from owner-scoped data that V2 has already loaded.

## More surface

The More grid now contains no dead “connected later” cards.

### Foods & meals

Reuses the P4 food library.

This keeps:

- saved foods,
- saved meals,
- favorites,
- exact nutrition editing,
- Open Food Facts review/import,

inside the established food-management workflow.

### Integrations

The Integrations card now opens a dedicated compact sheet instead of immediately jumping the user into Strategy.

It shows:

- current platform,
- Health Connect status,
- Diet data source / sync state.

On Android native builds, Health Connect actions mirror the already-certified P6 native controls.

On web/PWA:

- native Health Connect buttons are hidden,
- the integration sheet remains informative,
- the app remains fully usable without Health Connect.

The sheet can navigate to the existing Strategy activity context.

The P6 rule remains unchanged:

> Health/activity data explains unusual weeks. It is not automatically eaten back as calories.

## Body & weight

The old “Body measurements” placeholder has been renamed **Body & weight** because the canonical Diet model currently tracks weight, not arbitrary circumference/body-composition fields.

The sheet displays:

- latest scale weight,
- P1 trend weight,
- current goal weight,
- weigh-in count,
- date of latest weigh-in.

It explicitly states that other body measurements are not yet part of the canonical model.

Actions:

- export weight history as CSV,
- open the existing Progress weight chart.

No fake waist/body-fat measurement fields were added.

## Appearance

Appearance preferences are stored under:

`diet-copilot-v2-ui-preferences-v1`

in browser `localStorage`.

They are deliberately separate from owner nutrition data.

### Theme

Options:

- System
- Light
- Dark

Forced themes override the OS preference and set an appropriate CSS `color-scheme` so native inputs/selects match the app.

The browser `theme-color` metadata also follows the effective theme.

Preferences are applied in a tiny pre-paint script before the stylesheet loads, avoiding a visible light/dark flash.

### Density

Options:

- Comfortable
- Compact

Compact mode reduces whitespace/card height but does not deliberately reduce minimum touch targets.

### Motion

Options:

- System
- Reduce

Reduce disables app animation/transition timing even when the OS has not requested reduced motion.

The existing `prefers-reduced-motion` behavior remains in place.

### Accessibility

Appearance choices expose:

`aria-pressed`

so assistive technology can identify the currently selected option.

## Data & export

The Data & export sheet exposes three owner-data exports.

### Full JSON backup

Format:

`diet-copilot-backup`

Version:

`1`

The backup contains the owner-scoped Diet rows already loaded in V2.

It includes metadata:

- export format,
- version,
- export timestamp,
- app as-of date.

The backup helper recursively removes common credential/session fields before serialization, including:

- `access_token`
- `refresh_token`
- `provider_token`
- `provider_refresh_token`
- `token`
- `jwt`
- `authorization`
- `apikey`
- `api_key`
- `service_role_key`

The export may still contain private nutrition content such as meal notes because it is intended as the user's private backup.

It is downloaded locally and is not uploaded by the export flow.

### Nutrition CSV

Columns:

```text
date
calories
calorie_target
protein_g
day_status
```

The values come from the V2 read model rather than re-querying or recalculating nutrition.

### Weight CSV

Columns:

```text
date
scale_weight_kg
trend_weight_kg
```

Trend weight comes from the already-established P1 deterministic trend series.

CSV serialization handles commas, quotes and line breaks using standard quoting rules.

## Local privacy controls

The Data sheet shows:

- account state,
- cloud/cache source,
- offline-cache status,
- Copilot-history policy.

### Clear Copilot chat

Reuses the P8:

`DietV2Copilot.clearSession()`

boundary.

This removes session-only conversation history.

It does not alter nutrition data.

### Clear offline cache

V2 now exposes:

- `getDietV2OfflineCacheInfo()`
- `clearDietV2OfflineCache()`

The clear action removes only the browser's owner-scoped offline cache.

It does **not** delete:

- cloud meals,
- cloud weight entries,
- strategy history,
- saved foods,
- training/activity records,
- account data.

The UI states this explicitly.

## Data export bridge

V2 now exposes:

`getDietV2RawData()`

for the local export layer.

It returns a clone of the current owner-scoped raw V2 dataset rather than the mutable in-memory object.

Preferred path:

`structuredClone(...)`

Fallback:

JSON serialize/parse for the plain row data.

This export bridge does not expose the Supabase Auth session.

## Deterministic helper

Canonical:

`src/engine/settings-data.mjs`

Browser mirror:

`v2/engine/settings-data.mjs`

Version:

`1.0.0-p9`

It owns:

- preference normalization,
- CSV escaping,
- CSV generation,
- JSON backup construction,
- recursive credential-field scrubbing.

Keeping this logic outside DOM code makes it independently testable.

## P9 database contract

`supabase/tests/p9_settings_data_contract.sql`

asserts:

1. the authenticated Diet browser RPC surface remains the exact same 18 RPCs,
2. no direct authenticated writes exist on the protected Diet tables,
3. no `diet_settings`, `diet_preferences`, `diet_exports` or `diet_backups` persistence tables appear,
4. no new `diet_app_*setting*`, `diet_app_*export*` or `diet_app_*backup*` RPC appears,
5. P8 Copilot persistence tables remain absent.

Expected live result:

`diet_p9_settings_data_contract_ok`

## Tests

P9 adds:

- `tests/settings-data.mjs`
- `tests/v2-settings.mjs`

Coverage includes:

- valid preference normalization,
- invalid preference fallback,
- CSV quoting,
- nutrition CSV generation,
- weight CSV generation,
- empty-history handling,
- JSON backup format/version,
- recursive credential scrubbing,
- canonical/browser helper parity,
- all More controls exist,
- no old placeholder cards remain,
- forced light/dark CSS,
- compact density CSS,
- reduced-motion CSS,
- pre-paint preference loading,
- accessible selection state,
- unavailable native integration controls,
- empty weight-export state,
- local cache control,
- P8 Copilot session reuse,
- no direct RPCs in settings code,
- no privileged credentials in the settings bundle,
- cloned raw-data export bridge,
- unchanged 18-RPC mutation surface,
- Pages artifact presence and syntax.

## Product result

Before P9:

```text
More
├─ Foods & meals      working
├─ Integrations       shortcut
├─ Body measurements  placeholder
├─ Account             working
├─ Appearance          placeholder
└─ Data & export       placeholder
```

After P9:

```text
More
├─ Foods & meals      working
├─ Integrations       working
├─ Body & weight      working
├─ Account             working
├─ Appearance          working
└─ Data & export       working
```

The result is a complete secondary-control surface without making the day-to-day nutrition workflow more crowded.
