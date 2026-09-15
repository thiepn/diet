# Diet Copilot

Diet Copilot is a **ChatGPT-controlled nutrition log and diet intelligence system** with a read-only web dashboard and a native Android companion.

```text
You → ChatGPT → canonical Supabase backend → Web dashboard
                                          ↘ Android + Health Connect
```

**Stable web release:** `1.0.0`  
**Native Android milestone:** `V7.0`

## Product boundary

The dashboard is not a food-entry app. Meal and weight logging, corrections, photo/label interpretation, goals, reusable foods and coaching are handled through ChatGPT. The website displays Today, History, Trends and Insights. Android adds device capabilities the browser cannot provide.

Deliberate invariants:

- no manual food-entry form on the dashboard
- no Quick Capture workflow
- no requirement to close a day before its data counts
- no automatic activity-calorie eat-back
- no silent calorie-target changes
- hypothetical/planned food never contaminates logged intake
- Health Connect is activity context, not a second nutrition log

## Production backend

Diet Copilot uses the shared **THIEPN Account** Supabase project.

- Canonical project ref: `hycegznamzjhwinegaai`
- Web app: `https://thiepn.dev/diet/`
- Android app ID: `dev.thiepn.diet`
- Retired Diet project: `mrrqsqawwxwebsdmrnre`

The retired project must receive no Diet Copilot reads or writes.

Authenticated browser sessions are owner-scoped and read-only. Privileged nutrition mutations use private backend helpers with stable request IDs, idempotent retry and post-write verification. Native Health Connect activity is synchronized through the JWT-protected `diet-health-sync` function into the canonical `activity_daily` table.

## Tracking policy

**Every available logged value counts.** Day status is coverage metadata only.

- Calories and protein use every day containing logged intake.
- Weight analysis uses every available weigh-in.
- Fiber uses every known fiber value.
- Missing fiber remains unknown rather than becoming zero.
- Full fiber coverage is reported separately.
- Estimated meals count normally; uncertainty changes confidence, not inclusion.
- Legitimately repeated identical foods remain separate records.

## Intelligence

The stable product includes uncertainty-aware daily guidance, remembered foods and learned portions, verified barcode memory, recurring routines, weight-trend confidence, weekly intelligence, conservative adaptive calorie recommendations, goal forecasting, maintenance-transition guidance, metric provenance and integrity checking.

Recommendations never change targets automatically.

## Android V7

V7 is a thin Capacitor 8 Android shell around the certified Web 1.0 experience. It does not rewrite the product in Flutter or duplicate the dashboard.

### Health Connect

The native layer can read:

- steps
- active calories burned
- distance
- exercise sessions / derived exercise minutes
- background health access when supported and granted

Foreground sync is available from the Android-only Account card. WorkManager performs periodic background synchronization after the native encrypted session and Health Connect permissions are available.

### Native reminders

The Android companion schedules the existing opt-in:

- weigh-in reminder
- weekly review reminder

The obsolete day-close requirement is intentionally not restored.

### Session security

The WebView still signs in through the THIEPN Account. The current Supabase access/refresh session is handed to the native plugin and encrypted with Android Keystore AES/GCM so WorkManager can refresh and synchronize while the WebView is not active.

Google OAuth inside the native shell still requires the final system-browser/deep-link redirect allowlist to be certified on a real device. Email/password authentication remains part of the existing THIEPN Account flow.

## Dashboard

### Today

Calories, protein, fiber, weight, goal progress, meals and passive contextual guidance. Activity remains secondary context and does not become a large Today card.

### History

3D / 7D / 14D / 30D / 90D / All ranges, meal expansion, source quality, uncertainty ranges, and All / Exact / Estimated filters. Filters never change day totals.

### Trends

Weight / Calories / Protein / Fiber across 7D / 30D / 90D / 6M / All. Immature datasets are explicitly labeled rather than presented as established trends.

### Insights

One consolidated hierarchy: This week → Nutrition → Weight & goal → Food intelligence → Data quality.

## Source layout

```text
src/
  auth/
  core/
  intelligence/
  native/
  operations/
  styles/
  ui/
  config.js
  release.js

native/android/src/     # maintained Kotlin sources
scripts/                # web + Android generators
tests/
supabase/
archive/                # historical sources only
```

The generated `android/`, `www/` and `node_modules/` directories are ignored. The active native sources live under `native/android/src/` and `scripts/prepare-android.mjs` recreates the Android project deterministically.

## Build

### Web certification

```bash
node scripts/build-v68.mjs
node tests/policy.mjs
node tests/release.mjs
```

### Android debug build

```bash
npm install
npm run android:prepare
cd android
./gradlew assembleDebug
```

GitHub Actions performs the same Android generation/build and uploads `diet-copilot-v7-debug` as a debug APK artifact.

## Release policy

Web `1.0.0` remains the stable web baseline. V7 adds the Android platform layer. A production Play Store release still requires user-owned signing credentials, Play Console configuration and physical-device Health Connect certification; CI compilation alone is not treated as device certification.
