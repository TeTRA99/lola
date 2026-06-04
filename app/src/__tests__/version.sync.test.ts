/// <reference types="node" />
// Guard: the app version must be identical across all three places it lives, so
// the in-app footer (which reads app.json) can never disagree with the native
// builds. If this fails, run `node scripts/set-version.mjs <version>` to resync.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import appConfig from '../../app.json';

const APP_DIR = join(__dirname, '..', '..');

function iosVersion(): string {
  const plist = readFileSync(join(APP_DIR, 'ios/Lola/Info.plist'), 'utf8');
  const m = plist.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]*)<\/string>/);
  return m?.[1] ?? '';
}

function androidVersion(): string {
  const gradle = readFileSync(join(APP_DIR, 'android/app/build.gradle'), 'utf8');
  const m = gradle.match(/versionName\s+"([^"]*)"/);
  return m?.[1] ?? '';
}

describe('app version is in sync across app.json / iOS / Android', () => {
  const source = appConfig.expo.version;

  test('app.json has a valid semver version', () => {
    expect(source).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('iOS Info.plist matches app.json', () => {
    expect(iosVersion()).toBe(source);
  });

  test('Android build.gradle matches app.json', () => {
    expect(androidVersion()).toBe(source);
  });
});
