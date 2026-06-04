#!/usr/bin/env node
// Single-command version bump. Sets the version in ALL THREE places so they can
// never drift: app.json (the source of truth + what the in-app footer shows),
// iOS Info.plist (CFBundleShortVersionString), Android build.gradle (versionName).
//
//   node scripts/set-version.mjs 0.12.0
//
// version.sync.test.ts asserts these three stay equal, so a forgotten sync fails CI.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: node scripts/set-version.mjs <major.minor.patch>  (e.g. 0.12.0)');
  process.exit(1);
}

// 1. app.json (source of truth)
const appJsonPath = join(APP_DIR, 'app.json');
const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8'));
appJson.expo.version = version;
writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');

// 2. iOS Info.plist
const plistPath = join(APP_DIR, 'ios/Lola/Info.plist');
let plist = readFileSync(plistPath, 'utf8');
plist = plist.replace(
  /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/,
  `$1${version}$2`,
);
writeFileSync(plistPath, plist);

// 3. Android build.gradle
const gradlePath = join(APP_DIR, 'android/app/build.gradle');
let gradle = readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
writeFileSync(gradlePath, gradle);

console.log(`Version set to ${version} in app.json, ios/Lola/Info.plist, android/app/build.gradle.`);
console.log('Run `npx jest version.sync` to confirm they match.');
