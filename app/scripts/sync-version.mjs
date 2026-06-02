#!/usr/bin/env node
// Single source of truth for the app version = app.json.
//
// This repo commits the native ios/ and android/ folders and builds from them
// directly (not via `expo prebuild` each time), so their version fields can drift
// from app.json — which is how the device once showed 0.9.0 while app.json said
// 0.10.0. Run this after bumping app.json to stamp the SAME version + build number
// into both native projects, keeping iOS and Android unified.
//
//   node scripts/sync-version.mjs        (or: npm run sync-version)
//
// app.json fields used:
//   expo.version              → CFBundleShortVersionString  / versionName
//   expo.ios.buildNumber      → CFBundleVersion
//   expo.android.versionCode  → versionCode

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;

const version = app.version;
const iosBuild = String(app.ios?.buildNumber ?? '1');
const androidCode = Number(app.android?.versionCode ?? 1);

if (!version) {
  console.error('app.json expo.version is missing'); process.exit(1);
}

// iOS — ios/Lola/Info.plist
const plistPath = join(root, 'ios/Lola/Info.plist');
let plist = readFileSync(plistPath, 'utf8');
plist = plist.replace(
  /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/,
  `$1${version}$2`,
);
plist = plist.replace(
  /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/,
  `$1${iosBuild}$2`,
);
writeFileSync(plistPath, plist);

// Android — android/app/build.gradle
const gradlePath = join(root, 'android/app/build.gradle');
let gradle = readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${androidCode}`);
writeFileSync(gradlePath, gradle);

console.log(`Synced version ${version} — iOS build ${iosBuild}, Android versionCode ${androidCode}`);
