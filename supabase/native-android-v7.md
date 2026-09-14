# Diet Copilot V7.0 — Native Android + Health Connect

V7.0 adds a thin Android companion to the existing Diet Copilot Web 1.0 product. It does not create a second nutrition tracker or a second backend.

## Architecture

```text
ChatGPT -> canonical Supabase -> Web 1.0 dashboard
                                  ^
                                  |
                         Capacitor Android shell
                                  |
                             Health Connect
```

The canonical project remains `hycegznamzjhwinegaai`. The retired project must never receive Diet Copilot reads or writes.

## Product boundary

- Food, weight, goals and corrections remain conversation-first through ChatGPT.
- The dashboard remains read-only for nutrition data.
- Native Android adds Health Connect reads, background activity synchronization and local reminders.
- Activity is coaching context only. Active calories never automatically increase the calorie target.
- No Flutter rewrite and no Android-specific meal-entry UI are introduced.

## Health Connect data

V7.0 requests read access only for:

- steps
- active calories burned
- distance
- exercise sessions
- background health reads when the device/provider supports them

Exercise minutes are derived from Health Connect exercise-session duration. Health Connect data is written to `public.activity_daily` with `source = 'health_connect'`.

## Native session

The WebView continues to authenticate with the THIEPN Account Supabase session. The native bridge passes the current access/refresh session to the Android plugin, which stores it encrypted with Android Keystore AES/GCM. Background work can refresh the Supabase token without storing credentials in plain SharedPreferences.

## Synchronization

Foreground sync is exposed through `window.DietNative.sync()` and the Android-only Account card.

Background sync uses WorkManager on an approximately six-hour periodic schedule with a network constraint. The worker reads yesterday and today and performs idempotent upserts by `(user_id, activity_date)`.

The deployed `diet-health-sync` Edge Function has JWT verification enabled and writes only to the user ID encoded in the verified token.

## Reminders

Native reminders currently cover:

- weigh-in reminder
- weekly review reminder

They follow the existing profile preferences and timezone. The obsolete day-close workflow is intentionally not revived.

## Web behavior

`src/native/android-bridge.js` is included in the Web 1.0 bundle but is inert when the Capacitor `DietHealthConnect` plugin is absent. Normal `https://thiepn.dev/diet/` behavior therefore remains unchanged.

## Build

```bash
npm install
npm run android:prepare
cd android
./gradlew assembleDebug
```

`android/`, `www/` and `node_modules/` are generated and ignored. The maintained native source lives under `native/android/src/` and the generated Android project is recreated by `scripts/prepare-android.mjs`.

## Release boundary

GitHub Actions compile-certifies the generated Android project and publishes an unsigned/debug APK artifact. Play Store production signing and physical-device Health Connect certification are separate release steps because they require a user-owned signing configuration and a real eligible Android device.
