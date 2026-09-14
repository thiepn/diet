import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const run = (cmd, args, cwd = process.cwd()) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

run(process.execPath, ['scripts/build-native-web.mjs']);
fs.rmSync('android', { recursive: true, force: true });
run(npx, ['cap', 'add', 'android']);
run(npx, ['cap', 'sync', 'android']);

const rootGradle = 'android/build.gradle';
let root = fs.readFileSync(rootGradle, 'utf8');
if (!root.includes('kotlin-gradle-plugin')) {
  root = root.replace("classpath 'com.android.tools.build:gradle:8.13.0'", "classpath 'com.android.tools.build:gradle:8.13.0'\n        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.21'");
  fs.writeFileSync(rootGradle, root);
}

const appGradle = 'android/app/build.gradle';
let app = fs.readFileSync(appGradle, 'utf8');
if (!app.includes("apply plugin: 'kotlin-android'")) app = app.replace("apply plugin: 'com.android.application'", "apply plugin: 'com.android.application'\napply plugin: 'kotlin-android'");
app = app.replace(/versionName\s+"[^"]+"/, 'versionName "7.0.0"');
if (!app.includes('health-connect-client')) {
  app = app.replace('implementation project(\':capacitor-android\')', `implementation project(':capacitor-android')\n    implementation 'androidx.health.connect:connect-client:1.1.0'\n    implementation 'androidx.work:work-runtime-ktx:2.11.2'\n    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2'`);
}
fs.writeFileSync(appGradle, app);

const packageDir = 'android/app/src/main/java/dev/thiepn/diet';
fs.mkdirSync(packageDir, { recursive: true });
for (const file of fs.readdirSync('native/android/src')) {
  if (file.endsWith('.kt')) fs.copyFileSync(path.join('native/android/src', file), path.join(packageDir, file));
}

fs.writeFileSync(path.join(packageDir, 'MainActivity.java'), `package dev.thiepn.diet;\n\nimport android.os.Bundle;\nimport com.getcapacitor.BridgeActivity;\n\npublic class MainActivity extends BridgeActivity {\n  @Override\n  public void onCreate(Bundle savedInstanceState) {\n    registerPlugin(DietHealthConnectPlugin.class);\n    super.onCreate(savedInstanceState);\n  }\n}\n`);

const manifestPath = 'android/app/src/main/AndroidManifest.xml';
let manifest = fs.readFileSync(manifestPath, 'utf8');
const permissionBlock = `\n    <uses-permission android:name="android.permission.health.READ_STEPS" />\n    <uses-permission android:name="android.permission.health.READ_ACTIVE_CALORIES_BURNED" />\n    <uses-permission android:name="android.permission.health.READ_DISTANCE" />\n    <uses-permission android:name="android.permission.health.READ_EXERCISE" />\n    <uses-permission android:name="android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND" />\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n\n    <queries>\n        <package android:name="com.google.android.apps.healthdata" />\n    </queries>\n`;
if (!manifest.includes('READ_STEPS')) manifest = manifest.replace('<application', permissionBlock + '\n    <application');
if (!manifest.includes('HealthPermissionActivity')) {
  manifest = manifest.replace('        <activity\n            android:configChanges=', '        <activity android:name=".HealthPermissionActivity" android:exported="false" android:theme="@style/AppTheme.NoActionBar" />\n\n        <activity\n            android:configChanges=');
}
manifest = manifest.replace('android:allowBackup="true"', 'android:allowBackup="true"\n        android:usesCleartextTraffic="false"');
fs.writeFileSync(manifestPath, manifest);

console.log('Prepared Diet Copilot Android V7.0 project. Open ./android in Android Studio or run ./android/gradlew assembleDebug.');
