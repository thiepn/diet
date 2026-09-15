# Diet Copilot Android V7.0

This directory contains the maintained native source for the Diet Copilot Android companion. The full `android/` Gradle project is generated and intentionally not committed.

## Build

```bash
npm install
npm run android:prepare
cd android
./gradlew assembleDebug
```

`android:prepare` recreates the Capacitor Android project, copies the certified Web 1.0 assets into the app, applies the V7 dependencies/manifest settings, and copies the Kotlin sources from `native/android/src/`.

## Native responsibilities

- Health Connect availability and permission flow
- steps / active calories / distance / exercise-session reads
- foreground activity sync to the canonical Supabase backend
- periodic WorkManager activity sync
- Android Keystore-encrypted Supabase session handoff for background work
- weigh-in and weekly-review notifications
- Capacitor bridge exposed to the existing web UI as `DietHealthConnect`

## Non-responsibilities

The Android layer does not implement meal logging, weight logging, calorie-target editing, food memory, or a second account system. Those remain part of the existing ChatGPT → Supabase product architecture.

Activity calories are never automatically added to the calorie budget.

## Release certification

GitHub Actions builds an unsigned/debug APK and uploads it as `diet-copilot-v7-debug`. A Play Store release still requires:

1. user-owned release signing credentials,
2. Play Console configuration,
3. native Google OAuth redirect/deep-link allowlisting if Google sign-in is used inside the Android shell,
4. physical-device Health Connect and background-work testing.

A successful CI APK build certifies compilation and packaging; it does not substitute for real-device Health Connect certification.
